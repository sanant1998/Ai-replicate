'use client'

import { useRouter } from 'next/navigation'

export function ClassPicker({
  classLevels,
  current,
  subject,
}: {
  classLevels: { slug: string; label: string }[]
  current: string
  subject: string
}) {
  const router = useRouter()

  return (
    <select
      value={current}
      aria-label="Choose class"
      onChange={(e) => router.push(`/academic?class=${e.target.value}&subject=${subject}`)}
      className="rounded-xl border border-navy/15 bg-surface px-4 py-2 text-sm font-bold text-navy shadow-sm outline-none focus:border-amber"
    >
      {classLevels.map((c) => (
        <option key={c.slug} value={c.slug}>
          {c.label}
        </option>
      ))}
    </select>
  )
}
