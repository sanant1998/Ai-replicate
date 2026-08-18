'use client'

import { useSyncExternalStore } from 'react'
import { THEME_KEY, type Theme } from '@/lib/theme'



/**
 * The theme is browser state, not React state: it lives in localStorage and in
 * the operating system's preference, either of which can change without this
 * component doing anything. `useSyncExternalStore` is the hook for exactly that
 * — reading it in an effect and calling setState would also fight the lint rule
 * that exists to stop the extra render pass.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  // The OS preference can flip under us (sunset schedules do this), and another
  // tab of the same app can write a new choice.
  media.addEventListener('change', onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    media.removeEventListener('change', onChange)
    window.removeEventListener('storage', onChange)
  }
}

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    // Private browsing with storage disabled throws on read as well as write.
    return null
  }
}

/**
 * The theme in force right now: an explicit choice if there is one, otherwise
 * whatever the operating system says. Exported because the tools' own shell
 * needs the same answer to decide which theme to open in.
 */
export function resolveTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'dark' || explicit === 'light') return explicit
  return stored() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

function getSnapshot(): Theme {
  return resolveTheme()
}

/**
 * The server cannot know what this browser prefers. Returning null renders a
 * neutral button, which the client immediately replaces — rather than guessing
 * "light", which would show a moon to half the users for one frame.
 */
function getServerSnapshot(): null {
  return null
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // The theme still applies to this page load; it just is not remembered.
    }
    for (const notify of listeners) notify()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Before hydration there is no honest label, so the control is hidden from
      // assistive tech rather than announced as the wrong thing.
      aria-hidden={theme === null}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-navy-deep/70 transition hover:bg-navy/5 hover:text-navy-deep"
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}
