'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { currentUser, destroySession } from '@/lib/session'
import { hit } from '@/lib/rate-limit'

export type DeleteState = { error?: string }

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
