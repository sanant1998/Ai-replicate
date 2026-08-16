/** 6240 -> "1h 44m", 1980 -> "33m", 3599 -> "1h 0m", 0 -> "—" */
export function formatDuration(totalSec: number): string {
  if (!totalSec) return '—'
  // Round to whole minutes *first*, then split. Rounding the seconds remainder
  // on its own lets it reach 60 without ever carrying into the hour, which is
  // how 3599 rendered as "60m" and 7199 as "1h 60m".
  const totalMin = Math.round(totalSec / 60)
  if (totalMin === 0) return '<1m'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

/** 125 -> "2:05", 3725 -> "1:02:05" */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

/** 2700000 -> "₹27,000" */
export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100)
}
