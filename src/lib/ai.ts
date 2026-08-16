import 'server-only'
import OpenAI from 'openai'

/**
 * Shared, non-streaming OpenAI call for the Tools pages. The tutor route keeps
 * its own streaming client — this one is for "ask once, get a whole answer".
 */
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

export class AiUnavailable extends Error {}

export async function completeText(opts: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AiUnavailable('OPENAI_API_KEY is not configured on the server.')
  }

  // baseURL is left to the SDK, which reads OPENAI_BASE_URL — that is how
  // scripts/mock-openai.mjs stands in for the real API in development.
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: opts.maxTokens ?? 2000,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.prompt },
    ],
  })

  return (completion.choices[0]?.message?.content ?? '').trim()
}

/**
 * Same call, but the model is told to answer as JSON matching `shape`. Models
 * sometimes wrap JSON in prose or a code fence, so the first balanced object or
 * array in the reply is extracted rather than trusting the whole string.
 *
 * Deliberately not using response_format: json_object — that mode forbids a
 * top-level array, and the practice generator asks for exactly that.
 */
export async function completeJson<T>(opts: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<T> {
  const raw = await completeText({
    ...opts,
    system: `${opts.system}\n\nReply with JSON only. No prose, no code fences.`,
  })

  const start = raw.search(/[[{]/)
  if (start === -1) throw new Error('The model did not return JSON.')

  const opener = raw[start]
  const closer = opener === '[' ? ']' : '}'
  const end = raw.lastIndexOf(closer)
  if (end <= start) throw new Error('The model returned truncated JSON.')

  return JSON.parse(raw.slice(start, end + 1)) as T
}
