'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession, currentUser, destroySession, revokeAllSessions } from '@/lib/session'
import { hit } from '@/lib/rate-limit'

export type DeleteState = { error?: string }
export type AccountState = { error?: string; saved?: string }

/**
 * Changes the password from inside the account.
 *
 * Until this existed the only route to a new password was the forgotten-password
 * flow, which needs a working mailbox — and this app's users are children who
 * often do not control the address they signed up with. Someone who knows their
 * current password should never have to prove they can read email to change it.
 *
 * The current password is required even though the session already proves who
 * this is: a session is "this browser", and a password change is the one action
 * that decides who keeps every other browser.
 */
const PasswordChange = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    next: z.string().min(8, 'The new password must be at least 8 characters').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    message: 'The two new passwords do not match',
    path: ['confirm'],
  })
  .refine((v) => v.next !== v.current, {
    message: 'That is already your password',
    path: ['next'],
  })

export async function changePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const burst = await hit(`password:${user.id}`, 10, 60 * 60_000)
  if (!burst.ok) return { error: 'Too many attempts. Please try again later.' }

  const parsed = PasswordChange.safeParse({
    current: formData.get('current'),
    next: formData.get('next'),
    confirm: formData.get('confirm'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (!(await bcrypt.compare(parsed.data.current, user.passwordHash))) {
    return { error: 'That is not your current password' }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  })

  // Everyone holding an old cookie is signed out — that is the point of
  // changing a password after someone else has had your device. The cookie in
  // *this* browser is reissued at the new token version, so the person who made
  // the change is not thrown out along with them.
  await revokeAllSessions(user.id)
  await createSession({ uid: user.id, email: user.email })

  return { saved: 'Password changed. Every other device has been signed out.' }
}

/**
 * Signs out everywhere without changing the password.
 *
 * `revokeAllSessions` has existed since password reset needed it; there was no
 * way for a student to reach it. A shared school computer left signed in is the
 * ordinary case, not the exotic one.
 */
export async function signOutEverywhere(): Promise<AccountState> {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const burst = await hit(`revoke:${user.id}`, 10, 60 * 60_000)
  if (!burst.ok) return { error: 'Too many attempts. Please try again later.' }

  await revokeAllSessions(user.id)
  await createSession({ uid: user.id, email: user.email })
  return { saved: 'Signed out on every other device.' }
}

/** The name shown to the student and used in the tutor's system prompt. */
export async function updateName(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await currentUser()
  if (!user) redirect('/login?next=%2Fprofile')

  const name = String(formData.get('name') ?? '').trim()
  if (name.length < 2) return { error: 'Please enter your name' }
  if (name.length > 80) return { error: 'That name is too long' }

  await prisma.user.update({ where: { id: user.id }, data: { name } })
  revalidatePath('/academic', 'layout')
  revalidatePath('/profile')
  return { saved: 'Name updated.' }
}

/**
 * Erases the account.
 *
 * Every table that references User cascades on delete, so this one statement
 * takes progress, notes, bookmarks, quiz attempts, tutor conversations, the
 * credit ledger and the payment rows with it. That is the point — DPDP's right
 * to erasure is not satisfied by hiding the row — but it does mean the finance
 * record goes too. If you need to keep payments for tax, change Payment's
 * relation to SetNull and null the userId here instead; do it before you have
 * real revenue rather than after.
 *
 * Gated on the current password, not just the session: a deletion is
 * irreversible, and a borrowed phone left signed in should not be enough.
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await currentUser()
  if (!user) redirect('/login')

  const burst = await hit(`delete:${user.id}`, 5, 60 * 60_000)
  if (!burst.ok) return { error: 'Too many attempts. Please try again later.' }

  const password = String(formData.get('password') ?? '')
  if (!password) return { error: 'Enter your password to confirm' }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return { error: 'That password is not correct' }
  }

  if (formData.get('confirm') !== 'DELETE') {
    return { error: 'Type DELETE to confirm' }
  }

  // Refuse to remove the last admin: nobody would be able to reach role
  // management or the catalog again, and there is no way back through the UI.
  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (admins <= 1) {
      return { error: 'You are the only admin. Promote someone else before deleting this account.' }
    }
  }

  await prisma.user.delete({ where: { id: user.id } })
  await destroySession()
  redirect('/?deleted=1')
}
