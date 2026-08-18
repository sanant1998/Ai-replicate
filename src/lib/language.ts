/**
 * The languages a student can be taught in.
 *
 * `User.language` has been on the schema from the start, has been rendered in
 * the sidebar, and has never changed anything — including the `lang` attribute
 * on the document, which was hard-coded to "en".
 *
 * What this turns on is the *tutor's* language, not the interface's. Translating
 * the whole UI is a separate piece of work with its own review problem (nobody
 * here can proofread Marathi), and shipping half of it would be worse than
 * shipping none. Answering a Class 8 student's question in the language they
 * think in is the part that changes whether they understand the answer, and it
 * is the part a model does well.
 */
export type LanguageTag = (typeof LANGUAGES)[number]['tag']

export const LANGUAGES = [
  { tag: 'en-IN', label: 'English (India)', prompt: 'Indian English' },
  { tag: 'hi-IN', label: 'हिन्दी — Hindi', prompt: 'Hindi, in the Devanagari script' },
  { tag: 'mr-IN', label: 'मराठी — Marathi', prompt: 'Marathi, in the Devanagari script' },
  { tag: 'bn-IN', label: 'বাংলা — Bengali', prompt: 'Bengali' },
  { tag: 'ta-IN', label: 'தமிழ் — Tamil', prompt: 'Tamil' },
  { tag: 'te-IN', label: 'తెలుగు — Telugu', prompt: 'Telugu' },
  { tag: 'gu-IN', label: 'ગુજરાતી — Gujarati', prompt: 'Gujarati' },
  { tag: 'kn-IN', label: 'ಕನ್ನಡ — Kannada', prompt: 'Kannada' },
] as const

export const DEFAULT_LANGUAGE: LanguageTag = 'en-IN'

export function isLanguageTag(value: string): value is LanguageTag {
  return LANGUAGES.some((l) => l.tag === value)
}

/** A stored value that is no longer offered falls back rather than breaking. */
export function languageOf(tag: string | null | undefined) {
  return LANGUAGES.find((l) => l.tag === tag) ?? LANGUAGES[0]
}

/**
 * The instruction added to the tutor's system prompt.
 *
 * Nothing is said at all for English, because the prompt is already in English
 * and a redundant "answer in English" is one more thing for the model to weigh
 * against everything else it has been told.
 *
 * Technical terms stay in English on purpose: a student sitting a CBSE paper
 * has to write "photosynthesis", not a translation of it, and a tutor that
 * teaches them the wrong word to use in an exam has actively hurt them.
 */
export function languageInstruction(tag: string | null | undefined): string | null {
  const language = languageOf(tag)
  if (language.tag === DEFAULT_LANGUAGE) return null
  return [
    `Answer in ${language.prompt}, because that is the language the student chose.`,
    'Keep subject-specific terms, formulae and units in English — those are the words they must write in their exam. Explain them in their language.',
    'If they write to you in English, still answer in their chosen language unless they ask you to switch.',
  ].join(' ')
}
