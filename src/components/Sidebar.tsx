'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  IconAsk,
  IconBook,
  IconChart,
  IconCourses,
  IconHistory,
  IconProfile,
  IconSparkles,
  IconTools,
} from '@/components/icons'

const NAV = [
  { href: '/academic', label: 'Courses', Icon: IconCourses },
  { href: '/tutor', label: 'Ask Questions', Icon: IconAsk },
  { href: '/performance', label: 'Performance Analysis', Icon: IconChart },
  { href: '/notes', label: 'Notes & Saved', Icon: IconBook },
  { href: '/history', label: 'History', Icon: IconHistory },
  { href: '/tools', label: 'Tools', Icon: IconTools },
  { href: '/profile', label: 'Profile', Icon: IconProfile },
]

export type SidebarUser = {
  name: string
  dailyCredits: number
  dailyCreditCap: number
  boardCode: string | null
  classLabel: string | null
  language: string
  isPremium: boolean
  isAdmin: boolean
}

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname()

  // The admin link is hidden for everyone else; the pages and actions enforce
  // the role themselves, so this is presentation, not the access control.
  const nav = user?.isAdmin
    ? [...NAV, { href: '/admin', label: 'Content Admin', Icon: IconTools }]
    : NAV

  return (
    <aside className="w-64 shrink-0 px-4 py-6 max-lg:hidden">
      <div className="sticky top-6 rounded-3xl card-surface overflow-hidden">
        <div className="px-5 pt-5 pb-4">
          <Link href="/academic" className="text-2xl font-extrabold tracking-tight text-navy-deep">
            paper<span className="text-ember">Path</span>
          </Link>
        </div>

        <nav className="px-2 pb-2">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
                  active
                    ? 'bg-navy/10 font-bold text-navy-deep'
                    : 'text-navy-deep/75 hover:bg-navy/5 hover:text-navy-deep',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {user ? (
          <>
            <div className="mx-5 flex items-center justify-between border-t border-navy/10 py-3 text-sm">
              <span className="flex items-center gap-2 text-navy-deep/70">
                <span
                  className={clsx(
                    'size-2 rounded-full',
                    user.dailyCredits > 0 ? 'bg-moss' : 'bg-ember',
                  )}
                />
                Daily Credits
              </span>
              <span className="font-bold text-navy-deep">
                {user.dailyCredits}
                <span className="text-navy-deep/40">/{user.dailyCreditCap}</span>
              </span>
            </div>

            <div className="mx-5 border-t border-navy/10 py-3">
              <p className="mb-2 text-sm font-bold text-navy-deep">Academic Info</p>
              <dl className="space-y-1 text-[13px]">
                <Row label="Board" value={user.boardCode ?? '—'} />
                <Row label="Class" value={user.classLabel ?? '—'} />
                <Row label="Language" value={user.language === 'en-IN' ? 'English (India)' : user.language} />
              </dl>
            </div>

            <div className="p-4 pt-1">
              <Link
                href={user.isPremium ? '/profile' : '/pricing'}
                className="flex items-center justify-center gap-2 rounded-2xl flame-gradient px-4 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105"
              >
                <IconSparkles className="size-4" />
                {user.isPremium ? 'Premium Active' : 'Premium Plan'}
              </Link>
            </div>
          </>
        ) : (
          <div className="p-4">
            <Link
              href="/login"
              className="flex items-center justify-center rounded-2xl flame-gradient px-4 py-3 font-extrabold text-white shadow-lg shadow-ember/25 transition hover:brightness-105"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 px-2 text-xs text-navy-deep/45">
        <Link href="/terms" className="hover:underline">Terms of Use</Link>
        <span className="mx-2">·</span>
        <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
      </p>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-navy-deep/55">• {label}:</dt>
      <dd className="truncate font-semibold text-navy-deep">{value}</dd>
    </div>
  )
}
