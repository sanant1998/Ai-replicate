import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { grade, isCorrect } from '../src/lib/quiz.ts'

describe('isCorrect — MCQ', () => {
  it('compares the chosen index, not the option text', () => {
    assert.equal(isCorrect('MCQ', '2', '2'), true)
    assert.equal(isCorrect('MCQ', '2', '1'), false)
  })

  it('tolerates surrounding whitespace on either side', () => {
    assert.equal(isCorrect('MCQ', ' 0 ', '0 '), true)
  })

  it('marks an unanswered question wrong rather than defaulting to option 0', () => {
    // Number('') is 0, so anything that compares numerically would score a
    // blank answer as "chose the first option".
    assert.equal(isCorrect('MCQ', '0', ''), false)
    assert.equal(isCorrect('MCQ', '0', '   '), false)
  })
})

describe('isCorrect — NUMERIC', () => {
  it('accepts an exact match', () => {
    assert.equal(isCorrect('NUMERIC', '42', '42'), true)
  })

  it('ignores digit grouping and spaces', () => {
    assert.equal(isCorrect('NUMERIC', '1000000', '10,00,000'), true)
    assert.equal(isCorrect('NUMERIC', '3.14', ' 3.14 '), true)
  })

  it('allows rounding but not a different number', () => {
    assert.equal(isCorrect('NUMERIC', '3.141592', '3.1415921'), true)
    assert.equal(isCorrect('NUMERIC', '3.14', '3.15'), false)
  })

  it('handles zero without dividing by it', () => {
    assert.equal(isCorrect('NUMERIC', '0', '0'), true)
    assert.equal(isCorrect('NUMERIC', '0', '0.5'), false)
  })

  it('rejects text where a number is expected', () => {
    assert.equal(isCorrect('NUMERIC', '42', 'forty two'), false)
  })
})

describe('isCorrect — SHORT', () => {
  it('ignores case, spacing and a trailing full stop', () => {
    assert.equal(isCorrect('SHORT', 'Photosynthesis', 'photosynthesis'), true)
    assert.equal(isCorrect('SHORT', 'Newton s first law', 'newton   s  first law.'), true)
  })

  it('still requires the right answer', () => {
    assert.equal(isCorrect('SHORT', 'Photosynthesis', 'respiration'), false)
  })
})

describe('grade', () => {
  const questions = [
    { id: 'q1', kind: 'MCQ' as const, answer: '1', marks: 1 },
    { id: 'q2', kind: 'NUMERIC' as const, answer: '12', marks: 3 },
    { id: 'q3', kind: 'SHORT' as const, answer: 'friction', marks: 2 },
  ]

  it('weights the score by marks, not by question count', () => {
    const result = grade(questions, { q1: '1', q2: '12', q3: 'wrong' })
    assert.equal(result.score, 4)
    assert.equal(result.maxScore, 6)
  })

  it('records a row for every question, answered or not', () => {
    const result = grade(questions, { q1: '1' })
    assert.equal(result.rows.length, 3)
    assert.deepEqual(
      result.rows.map((r) => r.correct),
      [true, false, false],
    )
    // A missing answer is stored as an empty string, so the result page can
    // tell "left blank" apart from "answered wrongly".
    assert.equal(result.rows[1].given, '')
  })

  it('scores nothing on an empty submission', () => {
    const result = grade(questions, {})
    assert.equal(result.score, 0)
    assert.equal(result.maxScore, 6)
  })
})
