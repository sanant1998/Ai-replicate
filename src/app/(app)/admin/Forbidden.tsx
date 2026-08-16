import Link from 'next/link'
import { IconLock } from '@/components/icons'

export function Forbidden() {
  return (
    <div className="mx-auto max-w-md rounded-3xl card-surface px-8 py-12 text-center">
      <IconLock className="mx-auto size-10 text-navy/30" />
      <h1 className="mt-4 text-2xl font-extrabold text-navy-deep">Staff only</h1>
      <p className="mt-2 font-semibold text-navy/55">
        Your account does not have access to this area.
      </p>
      <Link
        href="/academic"
        className="mt-6 inline-block rounded-full flame-gradient px-7 py-3 font-extrabold text-white"
      >
        Back to courses
      </Link>
    </div>
  )
}
