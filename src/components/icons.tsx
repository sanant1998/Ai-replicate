import type { SVGProps } from 'react'

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
}

type P = SVGProps<SVGSVGElement>

export const IconCourses = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 6h6M4 12h6M4 18h6" />
    <path d="m14 6 2 2 4-4M14 14l2 2 4-4" />
  </svg>
)

export const IconAsk = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="14" rx="3" />
    <path d="M8 21l3-3" />
    <path d="M12 8v.01M12 11v3" />
  </svg>
)

export const IconChart = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

export const IconHistory = (p: P) => (
  <svg {...base} {...p}>
    <path d="m3 7 9-4 9 4-9 4-9-4Z" />
    <path d="m3 12 9 4 9-4M3 17l9 4 9-4" />
  </svg>
)

export const IconTools = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
)

export const IconProfile = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export const IconPlay = (p: P) => (
  <svg {...base} {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
  </svg>
)

export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="10" width="16" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
)

export const IconSparkles = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
  </svg>
)

export const IconBook = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" />
    <path d="M9 3v14" />
  </svg>
)

export const IconList = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="m5 13 4 4L19 7" />
  </svg>
)

export const IconSend = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 12 20 4l-8 16-2-6-6-2Z" />
  </svg>
)

export const IconRobot = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <path d="M12 4v4M9 13v1.5M15 13v1.5M2 12v3M22 12v3" />
  </svg>
)
