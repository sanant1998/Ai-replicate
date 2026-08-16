'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/email'
import { consumeResetToken, issueResetToken } from '@/lib/reset'
import { createSession, revokeAllSessions } from '@/lib/session'
import { actionIp, hit, hitIp } from '@/lib/rate-limit'
import { appOrigin } from '@/lib/origin'

export type ResetState = { error?: string; sent?: boolean }

export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = z.email().safeParse(formData.get('email'))
  if (!email.success) return { error: 'Enter a valid email address' }

  // Bound how many reset mails one address or origin can trigger. Report the
  // same "sent" screen either way so this stays a non-oracle.
  const perEmail = await hit(`reset:e:${email.data}`, 3, 60 * 60_000)
  const perIp = await hitIp('reset:ip', await actionIp(), 10, 60 * 60_000)
  if (!perEmail.ok || !perIp.ok) return { sent: true }

  const user = await prisma.user.findUnique({ where: { email: email.data } })

  // Always report success. Telling the caller whether an address is registered
  // turns this form into an account-enumeration oracle.
  if (user) {
    const raw = await issueResetToken(user.id)
    const url = `${await appOrigin()}/reset-password?token=${raw}`
    // Same reason as signup: the SMTP round trip is slow enough to time the
    // function out. The token is already written, so the link works regardless
    // of when the mail actually leaves.
    after(
      sendPasswordReset(user.email, url).catch((err) => {
        console.error('[reset] delivery failed', err)
      }),
    )
  }

  return { sent: true }
}

const NewPassword = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function completeReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const parsed = NewPassword.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (parsed.data.password !== formData.get('confirm')) {
    return { error: 'The two passwords do not match' }
  }

  const userId = await consumeResetToken(parsed.data.token)
  if (!userId) return { error: 'That reset link has expired or has already been used.' }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 10) },
  })

  // A reset exists because the account may already be in someone else's hands,
  // so every cookie issued before now stops working. Revoke first: createSession
  // stamps the token version it reads, and doing it the other way round would
  // invalidate the session we are about to hand back to the real owner.
  await revokeAllSessions(user.id)
  await createSession({ uid: user.id, email: user.email })
  redirect('/academic')
}
