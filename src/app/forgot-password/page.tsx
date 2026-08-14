import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/session'
import { ForgotForm } from './ForgotForm'

export default async function ForgotPasswordPage() {
  if (await currentUser()) redirect('/academic')

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-3xl font-extrabold tracking-tight text-navy-deep">
          paper<span className="text-ember">Path</span>
        </p>
        <ForgotForm />
      </div>
    </div>
  )
}
