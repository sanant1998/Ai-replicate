/**
 * Where the chosen theme is remembered.
 *
 * A plain module, deliberately: this constant is read by the root layout (a
 * server component, to build the inline no-flash script) and by ThemeToggle (a
 * client component, to read and write the value). Exporting it from the client
 * component instead does not fail to build — it fails at runtime, and quietly.
 * Next replaces a value imported from a `'use client'` module with a reference
 * proxy on the server, so interpolating it into the script produced
 *
 *   localStorage.getItem('function(){throw Error("Attempted to call THEME_KEY…
 *
 * — a syntax error in the one script that has to run before the first paint.
 * Neither `tsc` nor `next build` sees it; the browser suite's "no uncaught
 * client errors" check is what caught it.
 */
export const THEME_KEY = 'paperpath-theme'

export type Theme = 'light' | 'dark'
