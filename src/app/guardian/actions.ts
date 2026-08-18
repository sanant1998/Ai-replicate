'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { consumeGuardianToken, peekGuardianToken } from '@/lib/guardian'
import { createSession } from '@/lib/session'
import { actionIp, hitIp } from '@/lib/rate-limit'

export type GuardianState = { error?: string }

/**
 * Records a parent's consent, and optionally gives them an account to follow
 * along with.
 *
 * The token is spent here and nowhere earlier — the page that shows the parent
 * what they are agreeing to only peeks, so opening the link (or a mail client
 * prefetching it) does not consent on their behalf.
 */
const WithAccount = z.object({
  password: z.string().min(8, 'Choose a password of at least 8 characters').max(200),
  name: z.string().trim().min(2, 'Please enter your name').max(80),
})

export async function giveConsent(
  _prev: GuardianState,
  formData: FormData,
): Promise<GuardianState> {
  // Unauthenticated and it creates accounts, so it gets the signup treatment.
  const perIp = await hitIp('guardian:ip', await actionIp(), 10, 60 * 60_000)
  if (!perIp.ok) return { error: 'Too many attempts from here. Please try again later.' }

  const token = String(formData.get('token') ?? '')
  const wantsAccount = formData.get('createAccount') === 'on'

  const peeked = await peekGuardianToken(token)
  if (!peeked) {
    return { error: 'That link has expired or has already been used. Ask your child to send a new one.' }
  }

  // Validate everything the form needs *before* spending the single-use token,
  // so a mistyped password does not burn the link.
  const account = wantsAccount
    ? WithAccount.safeParse({ password: formData.get('password'), name: formData.get('name') })
    : null
  if (account && !account.success) return { error: account.error.issues[0].message }

  const guardianEmail = peeked.user.guardianEmail
  if (wantsAccount && !guardianEmail) {
    return { error: 'We do not have an address to attach an account to.' }
  }

  const studentId = await consumeGuardianToken(token)
  if (!studentId) {
    return { error: 'That link has just been used. Ask your child to send a new one.' }
  }

  await prisma.user.update({
    where: { id: studentId },
    data: { guardianConsentAt: new Date() },
  })

  if (!wantsAccount || !account?.success || !guardianEmail) redirect('/guardian/thanks')

  // An adult who already has a PaperPath account keeps it — creating a second
  // one on the same address is impossible anyway, and silently overwriting
  // their password would be an account takeover with extra steps.
  const existing = await prisma.user.findUnique({ where: { email: guardianEmail } })
  if (existing) {
    await prisma.parentLink.upsert({
      where: { parentId_studentId: { parentId: existing.id, studentId } },
      create: { parentId: existing.id, studentId },
      update: {},
    })
    redirect('/guardian/thanks?linked=existing')
  }

  const parent = await prisma.user.create({
    data: {
      email: guardianEmail,
      name: account.data.name,
      passwordHash: await bcrypt.hash(account.data.password, 10),
      role: 'PARENT',
      // The address is proved reachable by the fact they followed the link.
      emailVerifiedAt: new Date(),
      consentAcceptedAt: new Date(),
      children: { create: { studentId } },
    },
  })

  await createSession({ uid: parent.id, email: parent.email })
  redirect('/family')
}
