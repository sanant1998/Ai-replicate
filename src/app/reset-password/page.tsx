import Link from 'next/link'
import { redirect } from 'next/navigation'
import { readSession } from '@/lib/session'
import { ResetForm } from './ResetForm'

export default async function ResetPasswordPage(props: PageProps<'/reset-password'>) {
  if (await readSession()) redirect('/academic')
  const sp = await props.searchParams
  const token = typeof sp.token === 'string' ? sp.token : ''

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-3xl font-extrabold tracking-tight text-navy-deep">
          paper<span className="text-ember">Path</span>
        </p>

        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="rounded-3xl card-surface p-6 text-center">
            <h1 className="text-xl font-extrabold text-navy-deep">This link is incomplete</h1>
            <p className="mt-2 text-sm font-semibold text-navy/55">
              Open the link straight from your email, or request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block rounded-2xl flame-gradient px-6 py-2.5 font-extrabold text-white shadow-lg shadow-ember/25"
            >
              Request a new link
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
