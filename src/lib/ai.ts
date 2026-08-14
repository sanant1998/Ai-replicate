import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared, non-streaming Claude call for the Tools pages. The tutor route keeps
 * its own streaming client — this one is for "ask once, get a whole answer".
 */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'

export class AiUnavailable extends Error {}

export async function completeText(opts: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiUnavailable('ANTHROPIC_API_KEY is not configured on the server.')
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.prompt }],
  })

  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

/**
 * Same call, but the model is told to answer as JSON matching `shape`. Models
 * sometimes wrap JSON in prose or a code fence, so the first balanced object or
 * array in the reply is extracted rather than trusting the whole string.
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
