'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { resolveTheme } from '@/components/ThemeToggle'
import clsx from 'clsx'

export type ShellTab = { id: string; label: string; icon: ReactNode }

type Props = {
  title: string
  subtitle: string
  icon: ReactNode
  /** Shown bottom-left, e.g. "Graphing Calculator v1.0". */
  version?: string
  /** Optional right-hand status, e.g. "Ready". Rendered with a live dot. */
  status?: string
  tabs?: ShellTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  /** Controls and panels under the tab strip. */
  sidebar: ReactNode
  /** Extra controls in the header, left of the theme toggle. */
  headerExtra?: ReactNode
  onClose: () => void
  children: ReactNode
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function ToolShell({
  title,
  subtitle,
  icon,
  version,
  status,
  tabs,
  activeTab,
  onTabChange,
  sidebar,
  headerExtra,
  onClose,
  children,
}: Props) {
  // Opens in whatever theme the app is in, then keeps its own state — the
  // header toggle is a local override for this panel, not a second global
  // setting. Before the app had a theme this was hard-coded to light, which now
  // would mean opening a white panel over a dark page.
  const [dark, setDark] = useState(() => resolveTheme() === 'dark')
  const rootRef = useRef<HTMLDivElement>(null)

  // Escape closes, and the page behind must not scroll while the overlay is up.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  // Move focus into the dialog so keyboard users are not left behind it.
  useEffect(() => {
    rootRef.current?.focus()
  }, [])

  const iconButton =
    'grid size-9 place-items-center rounded-xl border transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-theme={dark ? 'dark' : 'light'}
      className="tool-shell fixed inset-0 z-50 flex flex-col outline-none"
      style={{ background: 'var(--shell-bg)', color: 'var(--shell-text)' }}
    >
      {/* ---- header ---------------------------------------------------- */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3"
        style={{ background: 'var(--shell-panel)', borderBottom: '1px solid var(--shell-line)' }}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl flame-gradient text-white">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="shell-title truncate text-xl leading-tight">{title}</h1>
          <p className="truncate text-xs font-semibold" style={{ color: 'var(--shell-muted)' }}>
            {subtitle}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {headerExtra}
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            aria-pressed={dark}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            className={iconButton}
            style={{ borderColor: 'var(--shell-line)', background: 'var(--shell-raise)' }}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close this tool"
            className={iconButton}
            style={{ borderColor: 'var(--shell-line)', background: 'var(--shell-raise)' }}
          >
            <IconClose />
          </button>
        </div>
      </header>

      {/* ---- body ------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside
          className="flex shrink-0 flex-col lg:w-[22rem]"
          style={{ background: 'var(--shell-panel)', borderRight: '1px solid var(--shell-line)' }}
        >
          {tabs && tabs.length > 0 && (
            <div
              role="tablist"
              aria-label={`${title} sections`}
              className="grid shrink-0 grid-cols-3 gap-1 p-2"
              style={{ borderBottom: '1px solid var(--shell-line)' }}
            >
              {tabs.map((tab) => {
                const selected = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    role="tab"
                    type="button"
                    aria-selected={selected}
                    onClick={() => onTabChange?.(tab.id)}
                    className={clsx(
                      'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-extrabold transition',
                      !selected && 'opacity-60 hover:opacity-100',
                    )}
                    style={selected ? { background: 'var(--shell-active)' } : undefined}
                  >
                    {selected && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                        style={{ background: 'var(--color-ember)' }}
                      />
                    )}
                    <span aria-hidden>{tab.icon}</span>
                    <span className="text-center leading-tight">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">{sidebar}</div>

          {(version || status) && (
            <div
              className="flex shrink-0 items-center justify-center gap-2 px-3 py-2.5 text-[11px] font-bold"
              style={{ borderTop: '1px solid var(--shell-line)', color: 'var(--shell-muted)' }}
            >
              <span>{version}</span>
              {status && (
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-moss" aria-hidden />
                  {status}
                </span>
              )}
            </div>
          )}
        </aside>

        <main className="scroll-slim min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  )
}

/**
 * A titled block inside a shell sidebar — the "About", "Features" and
 * "Examples" cards all share this frame.
 */
export function ShellCard({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={clsx('mb-3 rounded-2xl p-3 last:mb-0', className)}
      style={{ background: 'var(--shell-raise)', border: '1px solid var(--shell-line)' }}
    >
      {title && (
        <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: 'var(--shell-muted)' }}>
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

/** Panel surface for the main column, matching the sidebar cards. */
export function ShellPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx('rounded-2xl p-4', className)}
      style={{ background: 'var(--shell-panel)', border: '1px solid var(--shell-line)' }}
    >
      {children}
    </div>
  )
}
