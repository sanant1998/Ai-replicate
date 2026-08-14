import 'server-only'
import type { QuestionKind } from '@/generated/prisma/client'

/**
 * Marking lives on the server and only on the server. The client is sent
 * `prompt` and `options` — never `answer` — so a student reading the network
 * tab or the React payload sees no key to copy.
 */
export function isCorrect(
  kind: QuestionKind,
  expected: string,
  given: string,
): boolean {
  const g = given.trim()
  if (!g) return false

  switch (kind) {
    case 'MCQ':
      // `expected` is the 0-based index into options, as a string.
      return g === expected.trim()

    case 'NUMERIC': {
      const a = Number(g.replace(/[,\s]/g, ''))
      const b = Number(expected.replace(/[,\s]/g, ''))
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false
      // Tolerance covers rounding in decimals without accepting a wrong answer.
      return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6)
    }

    case 'SHORT':
      return normalise(g) === normalise(expected)

    default:
      return false
  }
}

/** Case, spacing and terminal punctuation shouldn't decide a short answer. */
function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function grade(
  questions: { id: string; kind: QuestionKind; answer: string; marks: number }[],
  given: Record<string, string>,
) {
  let score = 0
  let maxScore = 0
  const rows: { questionId: string; given: string; correct: boolean }[] = []

  for (const q of questions) {
    maxScore += q.marks
    const response = given[q.id] ?? ''
    const correct = isCorrect(q.kind, q.answer, response)
    if (correct) score += q.marks
    rows.push({ questionId: q.id, given: response, correct })
  }

  return { score, maxScore, rows }
}
