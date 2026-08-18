import './env.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveAnswer, suggestionsFromContent } from '../src/lib/guided.ts'

// A page of scraped past-paper text, in the shape it actually arrives in:
// numbered questions, marks in brackets, sentences run together with no space
// after the full stop, and tips and headings mixed in among the questions.
const SCRAPED = `A Level
Hardest AQA A level Chemistry Questions of All Time
By Bright Mind Tutors
Write a Commenton Hardest AQA A level Chemistry Questions of All Time

Every year exam boards intentionally put some questions that separate A scoring students from the rest.

Ques1) A molecule Q is ionised by electron impact in a TOF mass spectrometer. The Q+ ion has a kinetic energy of 2.09 10 -15 J .This ion takes 1.23 10–5 s to reach the detector. The length of the flight tube is 1.50 m .Calculate the relative molecular mass of Q. [5 marks]

Solution –

Step1) Recall equation

Ques2) A student prepared a buffer solution by adding 0.0136 mol of a salt KX to 100 cm3 of a 0.500 mol dm–3 solution of a weak acid HX. Calculate the pH of the buffer solution after adding the potassium hydroxide. [6 marks]

⭐Exam Tip (AQA A Level Chemistry)

Ques3) This question is about compounds containing ethanedioate ions.

Ques4) ✔ What is the oxidation state of manganese in the permanganate ion? [2 marks]
`

describe('suggestionsFromContent', () => {
  it('offers the instruction, not the whole paragraph of setup', () => {
    const [first] = suggestionsFromContent(SCRAPED)
    assert.equal(first, 'Calculate the relative molecular mass of Q.')
  })

  it('finds a question written as a question', () => {
    const found = suggestionsFromContent(SCRAPED)
    assert.ok(found.includes('What is the oxidation state of manganese in the permanganate ion?'))
  })

  it('drops the numbering and the mark scheme', () => {
    for (const s of suggestionsFromContent(SCRAPED)) {
      assert.doesNotMatch(s, /^Ques/i, s)
      assert.doesNotMatch(s, /marks?\]/i, s)
    }
  })

  it('stops at the limit it was given', () => {
    assert.equal(suggestionsFromContent(SCRAPED, 2).length, 2)
  })

  it('ignores headings, prose and the solution steps', () => {
    const found = suggestionsFromContent(SCRAPED, 10)
    assert.ok(!found.some((s) => s.startsWith('Every year')), 'took a line of prose')
    assert.ok(!found.some((s) => /^Step\d/.test(s)), 'took a solution step')
  })

  // Both of these were offered by the first version, on a real page.
  it('ignores page furniture that reads like an instruction', () => {
    const found = suggestionsFromContent(SCRAPED, 10)
    assert.ok(!found.some((s) => /write a comment/i.test(s)), 'took the comment link')
  })

  it('offers the question, not the note about how to format the answer', () => {
    const found = suggestionsFromContent(SCRAPED, 10)
    assert.ok(!found.some((s) => /decimal places/i.test(s)), 'took a formatting note')
    assert.ok(
      found.some((s) => s.startsWith('Calculate the pH of the buffer')),
      `did not find the buffer question: ${JSON.stringify(found)}`,
    )
  })

  it('skips a numbered question that is only a stem', () => {
    const found = suggestionsFromContent(SCRAPED, 10)
    assert.ok(!found.some((s) => /This question is about/i.test(s)), 'took a stem')
  })

  it('returns nothing rather than something wrong when there is no question', () => {
    assert.deepEqual(suggestionsFromContent('An atom has a nucleus. Electrons orbit it.'), [])
  })
})

describe('resolveAnswer', () => {
  const key = [
    { answer: '16', steps: ['8 + 8 = 16.'] },
    { answer: 'pH = 4.30', steps: [] },
  ]

  it('serves the stored answer, not the one the model wrote', () => {
    const out = resolveAnswer(
      { onTopic: true, matchedAnswerIndex: 1, answer: 'It is sixteen!', steps: ['a', 'b'] },
      'Topic',
      key,
    )
    assert.equal(out.answer, '16')
  })

  it('prefers the stored steps when there are any', () => {
    const out = resolveAnswer(
      { onTopic: true, matchedAnswerIndex: 1, answer: 'x', steps: ['model step'] },
      'Topic',
      key,
    )
    assert.deepEqual(out.steps, ['8 + 8 = 16.'])
  })

  it('lets the model write the steps when the entry has none', () => {
    const out = resolveAnswer(
      { onTopic: true, matchedAnswerIndex: 2, answer: 'x', steps: ['model step'] },
      'Topic',
      key,
    )
    assert.equal(out.answer, 'pH = 4.30')
    assert.deepEqual(out.steps, ['model step'])
  })

  it('keeps the model answer when nothing matched', () => {
    const out = resolveAnswer(
      { onTopic: true, matchedAnswerIndex: null, answer: 'From the material.', steps: ['a'] },
      'Topic',
      key,
    )
    assert.equal(out.answer, 'From the material.')
  })

  // An index the model invented must cost an exact answer, not the whole reply.
  it('treats an out-of-range index as no match rather than failing', () => {
    const out = resolveAnswer(
      { onTopic: true, matchedAnswerIndex: 99, answer: 'From the material.', steps: ['a'] },
      'Topic',
      key,
    )
    assert.equal(out.answer, 'From the material.')
    assert.deepEqual(out.steps, ['a'])
  })

  it('replaces a refusal with the one wording, whatever the model wrote', () => {
    const out = resolveAnswer(
      { onTopic: false, matchedAnswerIndex: 1, answer: 'I think it is 16 actually', steps: ['a'] },
      'Buffers',
      key,
    )
    assert.match(out.answer, /outside \*\*Buffers\*\*/)
    assert.deepEqual(out.steps, [])
    assert.equal(out.onTopic, false)
  })
})
