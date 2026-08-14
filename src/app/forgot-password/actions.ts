'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendPasswordReset } from '@/lib/email'
import { consumeResetToken, issueResetToken } from '@/lib/reset'
import { createSession } from '@/lib/session'
import { hit } from '@/lib/rate-limit'

export type ResetState = { error?: string; sent?: boolean }

async function origin() {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  return process.env.APP_ORIGIN ?? `${proto}://${host}`
}

async function ipFromHeaders() {
  if (process.env.TRUST_PROXY !== '1') return 'local'
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip')?.trim() ?? 'local'
}

export async function requestReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = z.email().safeParse(formData.get('email'))
  if (!email.success) return { error: 'Enter a valid email address' }

  // Bound how many reset mails one address or origin can trigger. Report the
  // same "sent" screen either way so this stays a non-oracle.
  const perEmail = hit(`reset:e:${email.data}`, 3, 60 * 60_000)
  const perIp = hit(`reset:ip:${await ipFromHeaders()}`, 10, 60 * 60_000)
  if (!perEmail.ok || !perIp.ok) return { sent: true }

  const user = await prisma.user.findUnique({ where: { email: email.data } })

  // Always report success. Telling the caller whether an address is registered
  // turns this form into an account-enumeration oracle.
  if (user) {
    const raw = await issueResetToken(user.id)
    const url = `${await origin()}/reset-password?token=${raw}`
    try {
      await sendPasswordReset(user.email, url)
    } catch (err) {
      console.error('[reset] delivery failed', err)
    }
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

  await createSession({ uid: user.id, email: user.email })
  redirect('/academic')
}
