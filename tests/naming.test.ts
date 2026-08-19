import './env.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  NAMING_MARKER,
  cleanTitle,
  materialForNaming,
  namingPrompt,
  parseNames,
} from '../src/lib/naming.ts'

describe('cleanTitle', () => {
  it('drops the numbering and markdown a model puts in front of a title', () => {
    assert.equal(cleanTitle('## 3. Redox titrations'), 'Redox titrations')
    assert.equal(cleanTitle('Chapter: Chemical equilibrium'), 'Chemical equilibrium')
    assert.equal(cleanTitle('- Buffer solutions'), 'Buffer solutions')
  })

  it('unwraps quotes and drops the trailing full stop', () => {
    assert.equal(cleanTitle('"Mole concept."'), 'Mole concept')
    assert.equal(cleanTitle('“Time of flight mass spectrometry”'), 'Time of flight mass spectrometry')
  })

  it('collapses the whitespace a pasted heading carries', () => {
    assert.equal(cleanTitle('  Ionic\n  equations  '), 'Ionic equations')
  })

  it('cuts an overlong title on a word, within the 200 the column takes', () => {
    const long = cleanTitle(`${'electrode potential '.repeat(30)}end`)
    assert.ok(long.length <= 200)
    assert.ok(!long.endsWith(' '))
    assert.ok(long.startsWith('electrode potential'))
  })
})

describe('parseNames', () => {
  it('reads both names back and cleans them', () => {
    const names = parseNames('{"topicTitle":"1. Buffer solutions","chapterTitle":"Acids and bases."}')
    assert.deepEqual(names, { topicTitle: 'Buffer solutions', chapterTitle: 'Acids and bases' })
  })

  it('refuses a reply that would blank a real title', () => {
    assert.equal(parseNames('{"topicTitle":"","chapterTitle":"Acids and bases"}'), null)
    assert.equal(parseNames('{"topicTitle":"Buffers"}'), null)
    assert.equal(parseNames('not json at all'), null)
  })
})

describe('materialForNaming', () => {
  it('passes a normal page of notes through whole', () => {
    const notes = 'Redox titrations.\nMnO4- + 5Fe2+ + 8H+ -> Mn2+ + 5Fe3+ + 4H2O'
    assert.equal(materialForNaming(`  ${notes}  `), notes)
  })

  it('keeps the head and the tail of an upload too big to send whole', () => {
    const huge = `HEAD MARKER${'x'.repeat(50_000)}TAIL MARKER`
    const sent = materialForNaming(huge)
    assert.ok(sent.length < 6_000)
    assert.ok(sent.startsWith('HEAD MARKER'))
    assert.ok(sent.endsWith('TAIL MARKER'))
    assert.ok(sent.includes('[...]'))
  })
})

describe('namingPrompt', () => {
  it('carries the marker the mock model server keys off', () => {
    const prompt = namingPrompt({
      subject: 'Chemistry',
      classLabel: 'Class - 11th',
      currentTopicTitle: 'Untitled topic',
      currentChapterTitle: 'Chapter 1',
      content: 'x'.repeat(200),
    })
    assert.ok(prompt.includes(NAMING_MARKER))
    assert.ok(prompt.includes('Chemistry'))
    assert.ok(prompt.includes('Class - 11th'))
  })
})
