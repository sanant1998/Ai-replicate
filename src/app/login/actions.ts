'use server'

import { redirect } from 'next/navigation'
import { after } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession, currentUser, destroySession, SIGNED_OUT_MESSAGE } from '@/lib/session'
import { actionIp, hit, hitIp } from '@/lib/rate-limit'
import { sendEmailVerification, sendGuardianConsent } from '@/lib/email'
import { issueVerificationToken } from '@/lib/verify-email'
import { issueGuardianToken } from '@/lib/guardian'
import { appOrigin } from '@/lib/origin'
import { safeNext } from '@/lib/safe-redirect'
import { reportError } from '@/lib/observability'

const Credentials = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type AuthState = { error?: string }

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Cap password guesses per address and per origin.
  const perEmail = await hit(`login:e:${parsed.data.email}`, 8, 10 * 60_000)
  const perIp = await hitIp('login:ip', await actionIp(), 30, 10 * 60_000)
  if (!perEmail.ok || !perIp.ok) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  // Compare unconditionally so a missing account and a wrong password take the
  // same amount of time — otherwise the response time leaks which emails exist.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
  const ok = await bcrypt.compare(parsed.data.password, hash)

  if (!user || !ok) return { error: 'Email or password is incorrect' }

  await createSession({ uid: user.id, email: user.email })
  // A test account has exactly one page. Sending it to `next` — which defaults
  // to the academic dashboard — would mean landing somewhere the app layout has
  // to bounce it off, and a redirect out of a layout mid-navigation renders an
  // empty document rather than the destination.
  redirect(user.testMode ? '/guided' : safeNext(formData.get('next')))
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Free signup is what makes the per-account credit cap cheap to farm.
  const perIp = await hitIp('signup:ip', await actionIp(), 5, 60 * 60_000)
  if (!perIp.ok) {
    return { error: 'Too many accounts created from here. Please try again later.' }
  }

  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Please enter your name' }

  // The users are minors, so consent is a hard gate, checked server-side.
  if (formData.get('consent') !== 'on') {
    return { error: 'Please confirm you have a parent or guardian’s permission' }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: 'An account with that email already exists' }

  // Trust the form only far enough to look the ids up: the class must exist and
  // must belong to the board that was submitted with it.
  const classLevelId = String(formData.get('classLevelId') ?? '')
  const boardId = String(formData.get('boardId') ?? '')

  const classLevel = classLevelId
    ? await prisma.classLevel.findUnique({ where: { id: classLevelId } })
    : null
  if (!classLevel || (boardId && classLevel.boardId !== boardId)) {
    return { error: 'Please choose your board and class' }
  }

  // A guardian's address, if one was given. Optional rather than required: a
  // hard gate here loses the student who does not have one to hand, and an
  // account with no guardian consent is still an account we can throttle and
  // still an account a guardian can be added to later from the profile.
  const guardianRaw = String(formData.get('guardianEmail') ?? '').trim()
  const guardianEmail = guardianRaw ? z.email().safeParse(guardianRaw) : null
  if (guardianEmail && !guardianEmail.success) {
    return { error: 'That parent or guardian email does not look right' }
  }
  if (guardianEmail?.data && guardianEmail.data.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { error: 'The guardian email must be different from your own' }
  }

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
      boardId: classLevel.boardId,
      classLevelId: classLevel.id,
      consentAcceptedAt: new Date(),
      guardianEmail: guardianEmail?.data ?? null,
    },
  })

  if (guardianEmail?.data) after(sendGuardianRequest(user.id, name, guardianEmail.data))

  // Signing in immediately is deliberate: an unverified account still works,
  // just on the reduced credit cap. Blocking a 13-year-old at the door over an
  // email they may not control loses the student; throttling the one thing that
  // costs money removes the incentive to farm addresses.
  //
  // Handed to after() rather than awaited: an SMTP handshake takes seconds, and
  // charging that to the request meant signup regularly outran a serverless
  // function's timeout and died — after the account row was already written.
  // The send still runs to completion, just once the redirect has gone out.
  after(sendVerificationEmail(user.id, user.email))

  await createSession({ uid: user.id, email: user.email })
  // A test account has exactly one page. Sending it to `next` — which defaults
  // to the academic dashboard — would mean landing somewhere the app layout has
  // to bounce it off, and a redirect out of a layout mid-navigation renders an
  // empty document rather than the destination.
  redirect(user.testMode ? '/guided' : safeNext(formData.get('next')))
}

/**
 * Issues a confirmation link and mails it. Delivery failure is logged, never
 * surfaced: the account exists either way, and the student can ask for another
 * link from their profile.
 */
async function sendVerificationEmail(userId: string, email: string) {
  try {
    const raw = await issueVerificationToken(userId)
    await sendEmailVerification(email, `${await appOrigin()}/verify-email?token=${raw}`)
  } catch (err) {
    reportError('signup/verification-mail', err, { userId })
  }
}

/**
 * Mails the guardian a consent link. Same failure policy as the confirmation
 * mail: logged, never surfaced. The account exists either way, and the student
 * can send another from their profile.
 */
async function sendGuardianRequest(userId: string, childName: string, guardianEmail: string) {
  try {
    const raw = await issueGuardianToken(userId)
    await sendGuardianConsent(
      guardianEmail,
      childName,
      `${await appOrigin()}/guardian?token=${raw}`,
    )
  } catch (err) {
    reportError('signup/guardian-mail', err, { userId })
  }
}

/**
 * Sends (or re-sends) the guardian consent request for the signed-in student,
 * to an address they can correct — a mistyped guardian email at signup would
 * otherwise be permanent.
 */
export async function requestGuardianConsent(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const user = await currentUser()
  if (!user) return { error: SIGNED_OUT_MESSAGE }

  const parsedEmail = z.email('Enter a valid email address').safeParse(
    String(formData.get('guardianEmail') ?? '').trim(),
  )
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0].message }
  if (parsedEmail.data.toLowerCase() === user.email.toLowerCase()) {
    return { error: 'The guardian email must be different from your own' }
  }

  const burst = await hit(`guardian:${user.id}`, 5, 24 * 60 * 60_000)
  if (!burst.ok) {
    return { error: 'We have sent a few already — check the spam folder, then try again tomorrow.' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { guardianEmail: parsedEmail.data },
  })
  after(sendGuardianRequest(user.id, user.name, parsedEmail.data))
  return {}
}

/** Re-sends the confirmation link for the signed-in account. */
export async function resendVerification(): Promise<AuthState> {
  const user = await currentUser()
  if (!user) return { error: SIGNED_OUT_MESSAGE }
  if (user.emailVerifiedAt) return {}

  const burst = await hit(`verify:resend:${user.id}`, 3, 60 * 60_000)
  if (!burst.ok) {
    return { error: 'We have sent a few already — check your spam folder, then try again later.' }
  }

  after(sendVerificationEmail(user.id, user.email))
  return {}
}

export async function logout() {
  await destroySession()
  redirect('/login')
}
