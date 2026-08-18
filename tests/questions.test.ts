import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { QUESTIONS, type QuestionSeed } from '../prisma/questions.ts'
import { isCorrect } from '../src/lib/quiz.ts'

/**
 * The question bank is hand-written data, and the failure mode is silent: an
 * MCQ whose `answer` points past the end of its options marks every attempt
 * wrong, and nothing in the app notices — the student just loses the mark.
 *
 * These are the checks a reviewer would do by eye on every new question, done
 * by the machine instead, because there are a hundred of them now.
 */
const entries = Object.entries(QUESTIONS)
const every = entries.flatMap(([key, list]) =>
  list.map((question, index) => ({ key, index, question })),
)

const label = (key: string, index: number) => `${key}[${index}]`

describe('question bank', () => {
  it('is keyed as "<subject slug>:<chapter index>"', () => {
    for (const [key] of entries) {
      assert.match(key, /^[a-z0-9-]+:[1-9][0-9]*$/, `${key} is not a valid chapter key`)
    }
  })

  it('has no empty chapters', () => {
    for (const [key, list] of entries) {
      assert.ok(list.length > 0, `${key} has no questions`)
    }
  })

  it('gives every MCQ at least two options and an answer that indexes one', () => {
    for (const { key, index, question } of every) {
      if (question.kind !== 'MCQ') continue
      const options = question.options ?? []
      assert.ok(options.length >= 2, `${label(key, index)} needs at least two options`)
      const answer = Number(question.answer)
      assert.ok(
        Number.isInteger(answer) && answer >= 0 && answer < options.length,
        `${label(key, index)} answer "${question.answer}" does not index its ${options.length} options`,
      )
    }
  })

  it('gives every MCQ distinct options', () => {
    for (const { key, index, question } of every) {
      if (question.kind !== 'MCQ') continue
      const options = question.options ?? []
      assert.equal(
        new Set(options.map((o) => o.trim().toLowerCase())).size,
        options.length,
        `${label(key, index)} repeats an option`,
      )
    }
  })

  it('keeps options off non-MCQ questions', () => {
    for (const { key, index, question } of every) {
      if (question.kind === 'MCQ') continue
      assert.ok(
        !question.options || question.options.length === 0,
        `${label(key, index)} is ${question.kind} but carries options, which the seed discards`,
      )
    }
  })

  it('gives every NUMERIC question an answer that is a number', () => {
    for (const { key, index, question } of every) {
      if (question.kind !== 'NUMERIC') continue
      assert.ok(
        Number.isFinite(Number(question.answer.replace(/[,\s]/g, ''))),
        `${label(key, index)} answer "${question.answer}" is not numeric`,
      )
    }
  })

  it('marks its own answer key correct', () => {
    // The end-to-end check: run every stored answer back through the marker the
    // server actually uses. Anything the grader would reject is a question that
    // nobody can get right.
    for (const { key, index, question } of every) {
      assert.equal(
        isCorrect(question.kind, question.answer, question.answer),
        true,
        `${label(key, index)} is not marked correct by its own answer`,
      )
    }
  })

  it('uses only whole marks between 1 and 20, and difficulty 1 to 3', () => {
    for (const { key, index, question } of every) {
      const marks = question.marks ?? 1
      const difficulty = question.difficulty ?? 1
      assert.ok(
        Number.isInteger(marks) && marks >= 1 && marks <= 20,
        `${label(key, index)} has marks ${marks}, outside what the admin form allows`,
      )
      assert.ok(
        Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 3,
        `${label(key, index)} has difficulty ${difficulty}, outside 1–3`,
      )
    }
  })

  it('writes prompts long enough for the admin editor to accept', () => {
    // The panel enforces 5–1000 characters. Seeded data that the panel would
    // refuse cannot be edited there afterwards.
    for (const { key, index, question } of every) {
      assert.ok(
        question.prompt.trim().length >= 5 && question.prompt.length <= 1000,
        `${label(key, index)} has a prompt the admin editor would reject`,
      )
    }
  })
})

describe('question bank coverage', () => {
  it('covers more than a token number of chapters', () => {
    // A regression guard rather than a target: this went from 6 chapters to 24,
    // and a refactor that quietly drops half the bank should fail here.
    assert.ok(entries.length >= 20, `only ${entries.length} chapters have a quiz`)
    assert.ok(every.length >= 90, `only ${every.length} questions in the bank`)
  })

  it('gives every chapter with a quiz at least three questions', () => {
    for (const [key, list] of entries) {
      assert.ok(list.length >= 3, `${key} has only ${list.length} question(s)`)
    }
  })
})

// Keeps the import honest if the seed type ever changes shape.
const _typecheck: QuestionSeed[] = Object.values(QUESTIONS)[0]
void _typecheck
