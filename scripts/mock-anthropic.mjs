// Minimal stand-in for the Anthropic Messages API, used to verify the tutor's
// SSE plumbing and the Tools pages' non-streaming calls without a real API key.
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

- This reply came from scripts/mock-anthropic.mjs, not from Claude.
- $a^2 + b^2 = c^2$
- Set ANTHROPIC_API_KEY and drop ANTHROPIC_BASE_URL to get real output.`

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

/** The Tools pages ask for JSON; give them JSON so the parser has something real to chew on. */
function pickText(body) {
  const system = String(body.system ?? '')
  if (system.includes('JSON only')) return PRACTICE
  return SHEET
}

function respondOnce(res, body) {
  const text = pickText(body)
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model: 'mock',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 40 },
    }),
  )
}

function respondStream(res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  const send = (type, data) =>
    res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)

  send('message_start', {
    message: {
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model: 'mock',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 0 },
    },
  })
  send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })

  let i = 0
  const timer = setInterval(() => {
    if (i < CHUNKS.length) {
      send('content_block_delta', { index: 0, delta: { type: 'text_delta', text: CHUNKS[i++] } })
      return
    }
    clearInterval(timer)
    send('content_block_stop', { index: 0 })
    send('message_delta', {
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 24 },
    })
    send('message_stop', {})
    res.end()
  }, 20)
}

createServer(async (req, res) => {
  if (!req.url.includes('/v1/messages')) {
    res.writeHead(404).end()
    return
  }

  const body = await readBody(req)
  if (body.stream) respondStream(res)
  else respondOnce(res, body)
}).listen(4010, '127.0.0.1', () => console.log('mock anthropic on :4010'))
