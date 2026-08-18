import 'server-only'
import { languageOf } from '@/lib/language'

/**
 * Guided practice: the tutor with its hands tied.
 *
 * The general tutor is allowed to know things. This one is not. It is given one
 * topic's material and a list of answers the client wants given, and it may say
 * nothing that is not in there. Three rules do the work:
 *
 *   1. Grounding. The material is the whole world. Off it, the answer is "not in
 *      this topic" — not a guess dressed up as one. This rule has two ways to
 *      fail and only one of them is obvious: answering what it should refuse,
 *      and refusing what it should answer. The second is the one that shows up
 *      in use — a student pastes a hint from their own notes, it does not
 *      parse as a question, and a tutor told to be strict decides it is off
 *      topic. So the prompt tests subject matter rather than phrasing, and says
 *      plainly which mistake is worse.
 *   2. Substitution. Where the client has written the answer, the client's words
 *      are what the student reads. The model picks which answer applies; the
 *      server, not the model, is what puts the text there. A model asked to
 *      "quote verbatim" mostly does. Mostly is not a guarantee, and this is the
 *      part the client is actually buying.
 *   3. Steps. The working comes back as a list, so the interface can hand it
 *      over one piece at a time. A model told to "stop after each step" will
 *      eventually not stop; a list that the UI reveals cannot fail to.
 */

export type GuidedAnswer = {
  onTopic: boolean
  /** 1-based position in the answer key the student is asking about, if any. */
  matchedAnswerIndex: number | null
  answer: string
  steps: string[]
}

/** What the model is required to return. Enforced by the API, not by hoping. */
export const GUIDED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['onTopic', 'matchedAnswerIndex', 'answer', 'steps'],
  properties: {
    onTopic: {
      type: 'boolean',
      description:
        'True when the message is about anything the material mentions, even in passing, and in any form — a question, a statement, a hint, a term, a symbol, or a follow-up. False only when the subject matter is genuinely elsewhere.',
    },
    matchedAnswerIndex: {
      type: ['integer', 'null'],
      description:
        'The number of the answer-key entry the student is asking about, even if they worded it differently. Null when no entry covers it.',
    },
    answer: {
      type: 'string',
      description:
        'The answer alone, at most two short sentences. No greeting, no restatement of the question, no closing remark.',
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description:
        'The working, two to six steps. Each step is one idea and stands on its own — the student reads them one at a time and cannot see the next one yet.',
    },
  },
} as const

/**
 * The marker the mock OpenAI server keys off to return a guided-shaped reply.
 * Kept in the prompt itself so the two cannot drift apart silently.
 */
export const GUIDED_MARKER = 'GUIDED_PRACTICE_JSON'

export type GuidedContext = {
  studentName: string
  language: string
  subject: string
  chapterTitle: string
  topicTitle: string
  content: string
  answerKey: { question: string; answer: string; steps: string[] }[]
}

export function guidedPrompt(ctx: GuidedContext): string {
  const language = languageOf(ctx.language)

  const lines = [
    `You are a ${GUIDED_MARKER} tutor. You are teaching ${ctx.studentName} one topic and nothing else: ${ctx.subject} — ${ctx.chapterTitle} — ${ctx.topicTitle}.`,
    '',
    'THE MATERIAL — this is everything you know:',
    '"""',
    ctx.content.trim(),
    '"""',
    '',
    'Rules, in order of precedence:',
    '1. The material above is the only source you may draw on. Answer from it and from nothing else — knowing something it does not say is not permission to say it.',
    '2. Before you decide anything, read back through the material looking for whatever bears on the message — a line, an equation, a symbol, a number, a step of a worked solution. If you find something, the answer comes from there and `onTopic` is true.',
    '3. Search by meaning, not by keyword. The material is not an index of its own wording: "the redox equation" asks for the ionic equation it gives, "the buffer one" names a question by its subject, a lone symbol asks what that symbol is. Different words for something the material contains are still that thing.',
    '4. The topic is the whole of the material, not only the questions in the answer key. Anything it mentions — an equation, a constant, a symbol, a unit, a term, a single line inside one worked solution — is yours to explain, and explaining it is never off topic. A student asking what one piece of a solution means is doing exactly what this is for.',
    '5. `onTopic` is about subject matter, not grammar. A question, a statement, a hint the student was given, a term, a request to explain one line, a follow-up to your own last answer — all of them are on topic when the material covers what they are about.',
    '6. Refuse only when you could name where it does belong instead — another chapter, another subject, or nothing to do with study. If you cannot say what else it is, it is this. Refusing something the material does cover is the worse of the two mistakes: it tells a student their own syllabus is out of bounds.',
    '7. When you do refuse, set onTopic to false, put a single sentence in `answer` saying this is outside the topic and to ask their teacher, and leave `steps` empty.',
    '8. Give the answer. Never withhold it, never reply with only a question back, never make the student guess first.',
    '9. `answer` is the result and nothing else. No greeting, no "great question", no restating what was asked, no summary at the end, no offer of further help, no background the student did not ask for.',
    '10. `steps` is how you got there. Two to six steps. One idea per step, in order, each one readable on its own — the student is shown them one at a time and cannot see ahead.',
    '11. Use the notation and words the material uses. Write mathematics in LaTeX between single $ for inline and $$ for display. Never use \\( \\) or \\[ \\].',
  ]

  if (ctx.answerKey.length > 0) {
    lines.push(
      '',
      'THE ANSWER KEY — questions the client has already answered. If the student is asking one of these, in any wording, put its number in matchedAnswerIndex. Judge by what is being asked, not by matching words.',
    )
    for (const [i, entry] of ctx.answerKey.entries()) {
      lines.push(`${i + 1}. Q: ${entry.question}`, `   A: ${entry.answer}`)
    }
    lines.push(
      '',
      'When you match an entry, `answer` must be that entry\'s answer. Your own wording is discarded for it either way — what you are actually deciding is which answer the student sees, so match carefully and set null when nothing fits.',
    )
  }

  if (language.tag !== 'en-IN') {
    lines.push(
      '',
      `Write the answer and every step in ${language.prompt}. Keep terms, formulae and units exactly as the material writes them — those are the words the student has to reproduce in an exam.`,
    )
  }

  return lines.join('\n')
}

/**
 * The questions offered on the empty screen, pulled out of the material itself.
 *
 * The answer key is the better source and is used first, but a topic often has
 * material and no key — someone pastes a page of notes and wants to try it
 * immediately. The fallback used to be three sentences built from the topic's
 * title ("Explain Some Basic Concepts of Chemistry — Part 1 in simple words"),
 * which tells a student nothing about what is actually in there and, when the
 * title no longer matches the material, is actively misleading.
 *
 * Done by reading the text rather than by asking the model: this renders on
 * every visit to the page, and a model call per page load is a bill and a delay
 * for three buttons. The rules below are deliberately narrow — a line that is
 * plainly a question, or plainly an instruction to work something out. Finding
 * nothing is fine; the caller falls back.
 */
const IMPERATIVE =
  /^(calculate|find|determine|explain|describe|state|show|deduce|suggest|identify|name|define|work out)\b/i

/**
 * Instructions about the answer rather than questions in their own right.
 *
 * These are the trailing line of a past-paper question — "give your answer to
 * two decimal places" — and picking one as a suggestion offers the student the
 * formatting note without the thing being asked.
 */
const META_INSTRUCTION = /^(give|write|state|show)\s+(your|the)\s+(answer|working|equation)\b/i

/** "Ques1)", "Q3.", "Question 2:" — a numbering scheme, not part of the question. */
const QUESTION_LABEL = /^(?:ques(?:tion)?\s*\d+\s*[).:\-]?\s*|q\s*\d+\s*[).:\-]\s*)/i

/** "[5 marks]", "(2 mark)" — mark schemes, which a student is not asking about. */
const MARKS = /[[(]\s*\d+\s*marks?\s*[\])]/gi

export function suggestionsFromContent(content: string, limit = 3): string[] {
  const found: string[] = []

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(MARKS, ' ').replace(/\s+/g, ' ').trim()
    if (!line) continue

    const labelled = QUESTION_LABEL.test(line)
    const body = line.replace(QUESTION_LABEL, '').trim()
    // A numbered question, or a line that is literally punctuated as one.
    // Bare imperatives are not enough on their own: scraped pages are full of
    // furniture that reads like one — "Write a Comment on …", "Find out more" —
    // and a wrong suggestion is worse than no suggestion.
    if (!labelled && !body.includes('?')) continue

    // A past-paper question is a paragraph of setup ending in one instruction.
    // The instruction is what the student would type, and the setup is already
    // in the material the tutor is reading, so offer the instruction alone.
    // Split on sentence ends including the ones with no space after the stop,
    // which is how scraped text usually arrives.
    const sentences = body
      .split(/(?<=[.?])\s+|(?<=[.?])(?=[A-Z])/)
      .map((s) => s.trim())
      .filter(Boolean)

    // No fallback to the whole line when nothing in it is an ask. A numbered
    // question often opens with a stem — "This question is about compounds
    // containing ethanedioate ions." — and offering the stem gives a student a
    // button that asks nothing. Skipping is the better failure: there are other
    // questions further down, and three good ones beat three filled slots.
    const ask = [...sentences]
      .reverse()
      .find((s) => !META_INSTRUCTION.test(s) && (s.endsWith('?') || IMPERATIVE.test(s)))
    if (!ask) continue

    // Scraped pages decorate their lines — "⭐", "✔", bullets, stray dashes.
    // Strip anything before the first letter, digit or maths delimiter.
    const text = ask
      .replace(/^[^\p{L}\p{N}$]+/u, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length < 15 || text.length > 180) continue
    if (found.some((f) => f.toLowerCase() === text.toLowerCase())) continue

    found.push(text)
    if (found.length >= limit) break
  }

  return found
}

/**
 * What a student is told when they ask something the topic does not cover.
 *
 * Written here rather than left to the model: a refusal is the one reply that
 * must be identical every time, because it is the one the client will read as
 * either "the guard works" or "it invented something".
 */
export function offTopicReply(topicTitle: string): string {
  return `That is outside **${topicTitle}**, so I can't answer it here. Ask your teacher, or switch to a topic that covers it.`
}

/**
 * Folds the model's reply and the answer key into what the student will see.
 *
 * Substitution happens here, on the server, after the model has spoken. An
 * out-of-range index is treated as no match rather than as an error: the model
 * getting the count wrong should cost an exact answer, not the whole reply.
 */
export function resolveAnswer(
  raw: GuidedAnswer,
  topicTitle: string,
  answerKey: { answer: string; steps: string[] }[],
): { answer: string; steps: string[]; onTopic: boolean } {
  if (!raw.onTopic) {
    return { answer: offTopicReply(topicTitle), steps: [], onTopic: false }
  }

  const i = (raw.matchedAnswerIndex ?? 0) - 1
  const matched = i >= 0 && i < answerKey.length ? answerKey[i] : null

  const steps = (matched?.steps.length ? matched.steps : raw.steps)
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    // The client's words where the client wrote them. This substitution is the
    // whole reason the answer key exists.
    answer: (matched?.answer ?? raw.answer).trim(),
    steps,
    onTopic: true,
  }
}

/**
 * The transcript line for one past turn.
 *
 * Answer and steps are stored apart so the interface can gate them, and joined
 * again here so the model sees what the student actually read. Sending only the
 * headline would let it repeat working it had already given.
 */
export function replayAssistant(content: string, steps: string[]): string {
  return steps.length > 0 ? `${content}\n\nWorking:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : content
}
