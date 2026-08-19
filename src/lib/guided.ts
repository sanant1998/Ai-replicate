import 'server-only'
import { languageOf } from '@/lib/language'

/**
 * Guided practice: the tutor scoped to one topic.
 *
 * The general tutor will talk about anything. This one is given one topic's
 * material and a list of answers the client wants given verbatim, and it stays
 * inside that topic. Three rules do the work:
 *
 *   1. Scope, in two layers. The material is the first source and the client's
 *      numbers and notation always win. But the topic is wider than the pages
 *      that happen to be uploaded: a definition the notes assume, the rule
 *      behind a step, another question of the same kind — a student needs those
 *      to follow the material at all, and the tutor answers them from its own
 *      knowledge rather than pretending not to know. What it refuses is a
 *      different subject, an unrelated chapter, or something that is not study.
 *
 *      This was strict grounding once — material or nothing — and it failed the
 *      way over-tight rules do: it started refusing things the notes did cover,
 *      because a scraped page rarely words a concept the way a student asks
 *      about it. Refusing a student their own syllabus is the worse of the two
 *      mistakes, and the prompt says so in as many words. `source` records which
 *      layer answered, so the two never blur together in the logs.
 *   2. Substitution. Where the client has written the answer, the client's words
 *      are what the student reads. The model picks which answer applies; the
 *      server, not the model, is what puts the text there. A model asked to
 *      "quote verbatim" mostly does. Mostly is not a guarantee, and this is the
 *      part the client is actually buying.
 *   3. Steps. The working comes back as a list, so the interface can hand it
 *      over one piece at a time. A model told to "stop after each step" will
 *      eventually not stop; a list that the UI reveals cannot fail to.
 */

/**
 * Where an answer came from.
 *
 * `material` is the topic's own notes — the client's words, their numbers, their
 * notation. `general` is the tutor's own knowledge, used when the question
 * belongs to this topic but the notes happen not to cover it: a definition they
 * assume, a rule they apply without stating, the background a student needs to
 * follow them. Both are answers. Neither is a refusal.
 */
export type GuidedSource = 'material' | 'general'

export type GuidedAnswer = {
  /**
   * The model's own one-line scope check, written before `onTopic` because strict
   * mode generates properties in declared order. Never shown to the student.
   *
   * It is here because the boolean alone was wrong on the questions that
   * matter: asked what a mole is, in a topic whose every calculation counts
   * moles, the model refused. Made to write down which subject the message is
   * from first, it stops refusing them. A named-subject field instead of the
   * boolean was tried and was worse — asked to name somewhere else, it found
   * somewhere else for anything not printed verbatim in the notes.
   */
  belongs?: string
  onTopic: boolean
  matchedAnswerIndex: number | null
  /** Optional because this type is a cast over parsed model output, and the
   *  mock model server predates the field. Absent is read as 'material'. */
  source?: GuidedSource
  answer: string
  steps: string[]
}

/** What the model is required to return. Enforced by the API, not by hoping. */
export const GUIDED_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['belongs', 'onTopic', 'matchedAnswerIndex', 'source', 'answer', 'steps'],
  properties: {
    // First in the object, and therefore first out of the model: strict mode
    // generates properties in declared order, so this sentence is written
    // before `onTopic` is chosen rather than as a justification for a choice
    // already made.
    belongs: {
      type: 'string',
      description:
        'One sentence, written before anything else: which subject this message belongs to, and whether a student working through the material above would meet it. Name the subject plainly. Do not answer the question here.',
    },
    onTopic: {
      type: 'boolean',
      description:
        'True when the message belongs to this topic in any form — a question, a statement, a hint, a bare term, a symbol, or a follow-up — and true whether or not the material happens to cover it, because that is what `source` is for. False only for a different subject, or something that is not study at all.',
    },
    matchedAnswerIndex: {
      type: ['integer', 'null'],
      description:
        'The number of the answer-key entry the student is asking about, even if they worded it differently. Null when no entry covers it.',
    },
    source: {
      type: 'string',
      enum: ['material', 'general'],
      description:
        'Where the content of your answer came from, not whether the wording matched. "material" whenever the material above contains what you said, under any name it gives it. "general" only when the material genuinely does not have it and you answered from your own knowledge of the topic. Not a way to refuse — a refusal is onTopic false.',
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

/**
 * What the student asked for, which decides whether the answer key overrides
 * the model.
 *
 * `ask` is a question: the client's written answer is what gets shown, because
 * that verbatim guarantee is the whole reason the key exists. `explain` is the
 * student pressing "Explain this step again" on working they have already been
 * given — there the client's words are precisely the words that did not land,
 * and substituting them back returns the same sentence a second time. So a
 * re-explanation is the model's own, still bounded by the material.
 */
export type GuidedIntent = 'ask' | 'explain'

export type GuidedContext = {
  studentName: string
  language: string
  subject: string
  chapterTitle: string
  topicTitle: string
  content: string
  answerKey: { question: string; answer: string; steps: string[] }[]
  intent?: GuidedIntent
}

export function guidedPrompt(ctx: GuidedContext): string {
  const language = languageOf(ctx.language)

  const lines = [
    `You are a ${GUIDED_MARKER} tutor. You teach ${ctx.studentName} ${ctx.subject}, working through one set of material with them: ${ctx.chapterTitle} — ${ctx.topicTitle}.`,
    '',
    `WHAT YOU ANSWER: anything in ${ctx.subject} that bears on the material below, or that a student working through it would need in order to follow it — the concepts it uses, the terms and units it does not stop to define, the theory behind its steps, more questions of the same kind. Say which chapter something is nominally from and you have still said nothing about whether you answer it: if a student meets it here, it is yours.`,
    `WHAT YOU REFUSE: another subject, or something that is not study at all. Nothing else.`,
    '',
    'THE MATERIAL — the notes for this topic, and your first source for every answer:',
    '"""',
    ctx.content.trim(),
    '"""',
    '',
    'Two decisions, in this order, every message:',
    'FIRST — is it yours? Write `belongs` before anything else: name the subject this message is from, and say whether a student working through the material would meet it. Then decide. On topic is an answer, off topic is a refusal, and there is nothing in between. Refusing something a student working through this material would reasonably ask is the worse of the two mistakes: it tells them their own syllabus is out of bounds. When you are unsure, answer.',
    'SECOND — where does the answer come from? Read back through the material for whatever bears on the message: a line, an equation, a symbol, a number, a step of a worked solution. If it is in there, answer from it, keep its numbers and its notation, and set `source` to "material". If it is not, answer from your own knowledge and set `source` to "general".',
    'The second decision never touches the first. Whether the material happens to cover something decides where its answer comes from; it never decides whether the student gets one. "It is not in the notes" is not a reason to withhold anything.',
    '',
    'The rest:',
    '1. Search by meaning, not by keyword. The material is not an index of its own wording: "the redox equation" asks for the ionic equation it gives, "the buffer one" names a question by its subject, a lone symbol asks what that symbol is. The material calling a thing by another name is still the material answering — that is `source` "material", not "general".',
    '2. The material always wins. Never contradict its numbers, its notation or its results with your own; where you would differ, use the material and say so.',
    '3. Anything the material mentions — an equation, a constant, a symbol, a unit, a term, one line inside one worked solution — is yours to explain. A student asking what one piece of a solution means is doing exactly what this is for. The answer key is only the questions with answers written for them, never the edge of what you answer.',
    '4. Scope is about subject matter, not grammar. A question, a statement, a hint the student was given, a bare term, a request to explain one line, a follow-up to your own last answer — all of them count.',
    '5. When you do refuse, set `onTopic` false, put a single sentence in `answer` saying this is outside the topic and to ask their teacher, and leave `steps` empty. The student is shown a fixed wording either way, so nothing you write there reaches them.',
    '6. Give the answer. Never withhold it, never reply with only a question back, never make the student guess first.',
    '7. `answer` is the result and nothing else. No greeting, no "great question", no restating what was asked, no summary at the end, no offer of further help, no background the student did not ask for.',
    '8. `steps` is how you got there. Two to six steps. One idea per step, in order, each one readable on its own — the student is shown them one at a time and cannot see ahead.',
    '9. Use the notation and words the material uses. Write mathematics in LaTeX between single $ for inline and $$ for display. Never use \\( \\) or \\[ \\].',
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
      ctx.intent === 'explain'
        ? 'Use the key to know what the right answer is. Do not copy its wording — see the re-explanation rules below.'
        : 'When you match an entry, `answer` must be that entry\'s answer. Your own wording is discarded for it either way — what you are actually deciding is which answer the student sees, so match carefully and set null when nothing fits.',
    )
  }

  if (ctx.intent === 'explain') {
    lines.push(
      '',
      'THIS MESSAGE IS A RE-EXPLANATION REQUEST. The student has already read the step quoted to you and did not follow it. Nothing here relaxes rule 1 — the material is still the only source.',
      'a. Say the same thing differently. Do not repeat the quoted wording and do not merely reorder it. Where it used a symbol, name the quantity; where it used a formula, say what the formula does before writing it.',
      'b. Explain that one step only. The steps around it are not yours to re-tell here.',
      'c. `steps` is the smaller pieces that one step breaks into, not the whole solution again. Two to four of them.',
      'd. Your wording is what the student reads this time — no answer-key entry stands behind it. Write the explanation itself, not a summary of one.',
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
  opts: { substitute?: boolean } = {},
): { answer: string; steps: string[]; onTopic: boolean; source: GuidedSource } {
  if (!raw.onTopic) {
    return { answer: offTopicReply(topicTitle), steps: [], onTopic: false, source: 'material' }
  }

  // Substitution is on for a question and off for a re-explanation. Handing the
  // client's answer back to a student who has just said they did not follow it
  // prints the same sentence a second time — which is exactly what "Explain this
  // step again" did on every topic that had a key, and did not do on the topics
  // that had none. That difference is why it looked like a deployment problem.
  const substitute = opts.substitute ?? true
  const i = (raw.matchedAnswerIndex ?? 0) - 1
  const matched = substitute && i >= 0 && i < answerKey.length ? answerKey[i] : null

  const steps = (matched?.steps.length ? matched.steps : raw.steps)
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    // The client's words where the client wrote them. This substitution is the
    // whole reason the answer key exists.
    answer: (matched?.answer ?? raw.answer).trim(),
    steps,
    onTopic: true,
    // A substituted answer is the client's material by definition, whatever the
    // model called it. Absent means an older reply or the mock, and those were
    // all material-sourced back when that was the only kind there was.
    source: matched ? 'material' : (raw.source ?? 'material'),
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
