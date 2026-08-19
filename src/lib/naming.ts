/**
 * Naming a topic from the material somebody just pasted.
 *
 * The panel used to ask for the names first and the material second, which is
 * backwards: whoever is uploading has a page of notes in the clipboard and no
 * particular opinion about what the topic is called. So the notes name the
 * topic — the model reads what was pasted and writes the two names the panel
 * shows, the topic's own and its chapter's, and both stay editable by hand.
 *
 * Suggestions only. Nothing here writes to the database; the action decides
 * that, and a staff member can overwrite either name before saving.
 */

/**
 * In the prompt so the mock server in scripts/mock-openai.mjs can tell this
 * call from the tutor's — same trick, and the same reason, as GUIDED_MARKER.
 */
export const NAMING_MARKER = 'TOPIC_NAMING_JSON'

export const NAMING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['topicTitle', 'chapterTitle'],
  properties: {
    topicTitle: {
      type: 'string',
      description:
        'What this particular material teaches, as a syllabus would name it. Two to eight words, no numbering, no "Topic" prefix, no trailing full stop.',
    },
    chapterTitle: {
      type: 'string',
      description:
        'The wider chapter this material belongs under — the unit a syllabus would file it in, broader than the topic and never identical to it. Two to eight words, no numbering.',
    },
  },
} as const

export type SuggestedNames = { topicTitle: string; chapterTitle: string }

/** How much of the material the naming call reads. */
const HEAD = 4_000
const TAIL = 1_500

/**
 * The material is uncapped by design, and one paste can be a whole unit's
 * notes. Naming does not need all of it: the first few thousand characters
 * carry the headings and definitions that say what this is, and the tail is
 * worth a look because scraped pages often bury the real subject in the last
 * worked example. Everything between them is repetition as far as a title is
 * concerned, so it is dropped rather than paid for on every save.
 */
export function materialForNaming(content: string): string {
  const text = content.trim()
  if (text.length <= HEAD + TAIL) return text
  return `${text.slice(0, HEAD)}\n\n[...]\n\n${text.slice(-TAIL)}`
}

export function namingPrompt(ctx: {
  subject: string
  classLabel: string
  currentTopicTitle: string
  currentChapterTitle: string
  content: string
}): string {
  return [
    `You are a ${NAMING_MARKER} cataloguer for a ${ctx.classLabel} ${ctx.subject} course.`,
    'You are given the notes a teacher has just pasted for one topic. Name it.',
    '',
    'THE MATERIAL:',
    materialForNaming(ctx.content),
    '',
    'RULES:',
    '1. Name what the material actually teaches, not what the current names say. The names below are what the panel shows now, often a placeholder — treat them as a hint about house style and nothing more.',
    `   Currently the topic: "${ctx.currentTopicTitle}"; currently the chapter: "${ctx.currentChapterTitle}".`,
    '2. Use the syllabus wording the material itself uses. If the notes say "Redox titrations", that is the name — do not translate it into your own phrasing.',
    '3. The chapter is the wider unit the topic sits in, and it must be broader than the topic and different from it. If the material is one narrow idea, the chapter is the standard unit that idea belongs to in this subject.',
    '4. Two to eight words each. No numbering, no "Chapter"/"Topic" prefix, no quotation marks, no trailing full stop.',
    `5. Write both names in the language the material is written in, in ${ctx.subject} terms a ${ctx.classLabel} student would recognise.`,
  ].join('\n')
}

/**
 * Trims a suggestion down to something the panel can put in a text field.
 *
 * The model is asked for a bare name and usually gives one, but a title that
 * arrives quoted, bulleted, or numbered — "3. Redox titrations" — would carry
 * that punctuation into the heading of every page the topic appears on, so it
 * is stripped here rather than left to whoever is proof-reading.
 */
export function cleanTitle(raw: string): string {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  const unwrapped = collapsed
    // Markdown heading and list markers, then a leading index of any style.
    .replace(/^[#*_>\-\s]+/, '')
    .replace(/^(chapter|topic|unit|lesson)\s*[:\-–]?\s*/i, '')
    .replace(/^\d+\s*[.):\-–]\s*/, '')
    // Straight and curly quotes around the whole thing.
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[.,;:\s]+$/, '')
    .trim()
  // 200 is the column the titles are validated against everywhere else in the
  // panel; cut on a word so a long one reads as a name rather than a fragment.
  if (unwrapped.length <= 200) return unwrapped
  const cut = unwrapped.slice(0, 200)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()
}

/**
 * Reads the model's JSON back. Returns null when either name came back empty
 * or unusably short — a blank suggestion must not be offered as a rename, and
 * the caller says "could not name it" rather than clearing a real title.
 */
export function parseNames(raw: string): SuggestedNames | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const { topicTitle, chapterTitle } = parsed as Record<string, unknown>
  if (typeof topicTitle !== 'string' || typeof chapterTitle !== 'string') return null

  const topic = cleanTitle(topicTitle)
  const chapter = cleanTitle(chapterTitle)
  if (topic.length < 2 || chapter.length < 2) return null

  return { topicTitle: topic, chapterTitle: chapter }
}
