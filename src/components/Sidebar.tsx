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
  IconList,
  IconProfile,
  IconRobot,
  IconSparkles,
  IconTools,
} from '@/components/icons'
import { languageOf } from '@/lib/language'
import { ThemeToggle } from '@/components/ThemeToggle'
import { logout } from '@/app/login/actions'

const NAV = [
  // /courses is the catalog of everything on offer; /academic is the chapter
  // browser for the class you are actually studying. Both exist on purpose.
  { href: '/courses', label: 'Courses', Icon: IconCourses },
  { href: '/academic', label: 'Academic', Icon: IconList },
  { href: '/tutor', label: 'Ask Questions', Icon: IconAsk },
  { href: '/guided', label: 'Guided Practice', Icon: IconRobot },
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
  /** Teacher or admin — controls whether the staff link appears at all. */
  isStaff: boolean
  /** Has at least one child linked, so the family view has something to show. */
  isParent: boolean
  /** A test account: Guided Practice and a way out, and nothing else. */
  testMode: boolean
}

export function Sidebar({ user }: { user: SidebarUser | null }) {
  const pathname = usePathname()

  // A test account is here for one screen. Everything else — the catalog, the
  // credit counter, the upgrade button — is either noise or an invitation to
  // wander somewhere the layout will only bounce them back from.
  if (user?.testMode) return <TesterSidebar name={user.name} pathname={pathname} />

  // Links are hidden for everyone else; the pages and actions enforce the role
  // themselves, so this is presentation, not the access control.
  const nav = [
    ...NAV,
    ...(user?.isParent ? [{ href: '/family', label: 'Family', Icon: IconChart }] : []),
    ...(user?.isStaff
      ? [
          {
            href: '/admin',
            label: user.isAdmin ? 'Content Admin' : 'Teacher Desk',
            Icon: IconTools,
          },
        ]
      : []),
  ]

  return (
    <aside className="w-64 shrink-0 px-4 py-6 max-lg:hidden">
      {/* One sticky wrapper around the card *and* the footer links. Sticking
          only the card left the links in normal flow, so scrolling a long page
          slid them off the top while the card stayed pinned — the two came
          apart, and the links ended up floating above the sidebar.

          Capped to the viewport and scrollable inside it, because pinning a
          column taller than the screen is how you make its bottom permanently
          unreachable — and the bottom is where the sign-in and Premium buttons
          are. */}
      <div className="scroll-slim sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto">
        <div className="rounded-3xl card-surface overflow-hidden">
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
                  <Row label="Tutor language" value={languageOf(user.language).label} />
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

        <div className="mt-3 px-2">
          <ThemeToggle />
        </div>

        <p className="mt-3 px-2 text-xs text-navy-deep/45">
          <Link href="/terms" className="hover:underline">Terms of Use</Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </aside>
  )
}

function TesterSidebar({ name, pathname }: { name: string; pathname: string }) {
  const active = pathname === '/guided' || pathname.startsWith('/guided/')

  return (
    <aside className="w-64 shrink-0 px-4 py-6 max-lg:hidden">
      <div className="sticky top-6 overflow-hidden rounded-3xl card-surface">
        <div className="px-5 pt-5 pb-4">
          <Link href="/guided" className="text-2xl font-extrabold tracking-tight text-navy-deep">
            paper<span className="text-ember">Path</span>
          </Link>
          <p className="mt-1 text-xs font-bold uppercase tracking-wider text-amber">Test account</p>
        </div>

        <nav className="px-2 pb-2">
          <Link
            href="/guided"
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition',
              active
                ? 'bg-navy/10 font-bold text-navy-deep'
                : 'text-navy-deep/75 hover:bg-navy/5 hover:text-navy-deep',
            )}
          >
            <IconRobot className="size-[18px] shrink-0" />
            Guided Practice
          </Link>
        </nav>

        <div className="border-t border-navy/10 p-4">
          <p className="mb-3 truncate text-sm font-bold text-navy-deep">{name}</p>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-2xl border border-navy/15 px-4 py-2.5 text-sm font-bold text-navy/60 transition hover:border-ember hover:text-ember"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
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
