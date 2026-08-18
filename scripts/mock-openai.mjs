// Minimal stand-in for the OpenAI Chat Completions API, used to verify the
// tutor's SSE plumbing and the Tools pages' non-streaming calls without a real
// API key.
//
// Which shape to return is decided by the request body's `stream` flag, exactly
// as the real API does — the tutor route streams, the Tools call does not.
import { createServer } from 'node:http'

const CHUNKS = [
  'Think of ',
  'a rational number ',
  'as any number you can write as p/q. ',
  'What is 1/2 + 1/3?',
]

const SHEET = `# Mock revision sheet

- This reply came from scripts/mock-openai.mjs, not from OpenAI.
- $a^2 + b^2 = c^2$
- Set OPENAI_API_KEY and drop OPENAI_BASE_URL to get real output.`

const PRACTICE = JSON.stringify([
  {
    question: 'Mock question 1: solve $2x + 5 = 13$.',
    answer: 'x = 4',
    working: '2x = 13 - 5 = 8, so x = 4.',
  },
  {
    question: 'Mock question 2: find $\\sqrt{169}$.',
    answer: '13',
    working: '13 x 13 = 169.',
  },
])

// The guided tutor asks for one object matching a schema, so the mock has to
// return that shape or the route's JSON.parse gets prose. Keyed off the marker
// the guided prompt carries (see src/lib/guided.ts), which is in the prompt
// precisely so the two cannot drift apart.
const GUIDED = JSON.stringify({
  onTopic: true,
  matchedAnswerIndex: 1,
  answer: 'Mock answer — this came from scripts/mock-openai.mjs, not from OpenAI.',
  steps: [
    'Step one: read what the question is actually asking.',
    'Step two: pull the rule out of the topic material.',
    'Step three: apply it and write the result.',
  ],
})

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
  })
}

/**
 * The Tools pages ask for JSON; give them JSON so the parser has something real
 * to chew on. OpenAI carries the system prompt as the first message rather than
 * a top-level field, so that is where the marker is read from.
 */
function pickText(body) {
  const system = (body.messages ?? [])
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n')
  if (system.includes('GUIDED_PRACTICE_JSON')) return GUIDED
  if (system.includes('JSON only')) return PRACTICE
  return SHEET
}

function respondOnce(res, body) {
  const text = pickText(body)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mock',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text, refusal: null },
          logprobs: null,
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 40, total_tokens: 50 },
    }),
  )
}

function respondStream(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })

  const base = {
    id: 'chatcmpl-mock',
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: 'mock',
  }
  // OpenAI streams bare `data:` frames with no `event:` line, and closes with
  // the literal [DONE] sentinel.
  const send = (choice) => res.write(`data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`)

  send({ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null })

  let i = 0
  const timer = setInterval(() => {
    if (i < CHUNKS.length) {
      send({ index: 0, delta: { content: CHUNKS[i++] }, finish_reason: null })
      return
    }
    clearInterval(timer)
    send({ index: 0, delta: {}, finish_reason: 'stop' })
    res.write('data: [DONE]\n\n')
    res.end()
  }, 20)
}

createServer(async (req, res) => {
  // Readiness probe for CI, which has to know this is listening before it
  // starts the app that will call it. Not part of the OpenAI surface.
  if (req.url.startsWith('/healthz')) {
    res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}')
    return
  }

  if (!req.url.includes('/chat/completions')) {
    res.writeHead(404).end()
    return
  }

  const body = await readBody(req)
  if (body.stream) respondStream(res)
  else respondOnce(res, body)
}).listen(4010, '127.0.0.1', () => console.log('mock openai on :4010'))
