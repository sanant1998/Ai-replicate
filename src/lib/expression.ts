/**
 * A small mathematical expression parser.
 *
 * Deliberately not `eval` or `new Function`: these expressions come from a text
 * box, and the graphing tool feeds one to the parser hundreds of times per
 * redraw. So an expression is *compiled once* into a closure, then evaluated
 * cheaply per point — parsing inside the plot loop would be the slow way round.
 *
 * Grammar (lowest precedence first):
 *   expression := term      (('+' | '-') term)*
 *   term       := unary     (('*' | '/' | '%') unary)*
 *   unary      := ('-' | '+' | '√') unary | power
 *   power      := postfix   ('^' unary)?           -- right associative
 *   postfix    := primary   '!'*
 *   primary    := number | constant | name '(' args ')' | '(' expression ')'
 *
 * Note that unary sits *above* power, not below it: -2^2 parses as -(2^2) = -4,
 * which is the mathematical convention. Putting power above unary — as an
 * earlier version of this comment described — would give (-2)^2 = 4.
 */

export type AngleMode = 'deg' | 'rad'

export type EvalContext = {
  /** Free variables, e.g. { x: 1.5 } for the graphing tool. */
  vars?: Record<string, number>
  angleMode?: AngleMode
}

/** A parsed expression, ready to evaluate as many times as needed. */
export type Compiled = {
  evaluate: (ctx?: EvalContext) => number
  /** Free variable names the expression actually referenced. */
  variables: string[]
}

export class ExpressionError extends Error {}

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'number'; value: number }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string }

const OPERATOR_CHARS = '+-*/^%()!,'

function tokenise(src: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < src.length) {
    const ch = src[i]!

    if (ch === ' ' || ch === '\t' || ch === '\n') {
      i++
      continue
    }

    if (ch >= '0' && ch <= '9') {
      let j = i
      while (j < src.length && /[0-9]/.test(src[j]!)) j++
      if (src[j] === '.') {
        j++
        while (j < src.length && /[0-9]/.test(src[j]!)) j++
      }
      // Exponent form: 1e3, 2.5e-4
      if (src[j] === 'e' || src[j] === 'E') {
        let k = j + 1
        if (src[k] === '+' || src[k] === '-') k++
        if (k < src.length && /[0-9]/.test(src[k]!)) {
          while (k < src.length && /[0-9]/.test(src[k]!)) k++
          j = k
        }
      }
      tokens.push({ kind: 'number', value: Number(src.slice(i, j)) })
      i = j
      continue
    }

    // A bare '.' still starts a number: ".5"
    if (ch === '.' && /[0-9]/.test(src[i + 1] ?? '')) {
      let j = i + 1
      while (j < src.length && /[0-9]/.test(src[j]!)) j++
      tokens.push({ kind: 'number', value: Number(src.slice(i, j)) })
      i = j
      continue
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < src.length && /[a-zA-Z0-9_]/.test(src[j]!)) j++
      tokens.push({ kind: 'name', value: src.slice(i, j).toLowerCase() })
      i = j
      continue
    }

    if (OPERATOR_CHARS.includes(ch)) {
      tokens.push({ kind: 'op', value: ch })
      i++
      continue
    }

    // Common typographic stand-ins for the ASCII operators.
    if (ch === '×' || ch === '·') {
      tokens.push({ kind: 'op', value: '*' })
      i++
      continue
    }
    if (ch === '÷') {
      tokens.push({ kind: 'op', value: '/' })
      i++
      continue
    }
    if (ch === '−') {
      tokens.push({ kind: 'op', value: '-' })
      i++
      continue
    }
    if (ch === 'π') {
      tokens.push({ kind: 'name', value: 'pi' })
      i++
      continue
    }
    // A prefix operator rather than the name `sqrt`, so that √9 works without
    // the parentheses that a function call would demand.
    if (ch === '√') {
      tokens.push({ kind: 'op', value: '√' })
      i++
      continue
    }

    throw new ExpressionError(`Unexpected character “${ch}”`)
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Functions and constants
// ---------------------------------------------------------------------------

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
}

const toRad = (v: number, mode: AngleMode) => (mode === 'deg' ? (v * Math.PI) / 180 : v)
const fromRad = (v: number, mode: AngleMode) => (mode === 'deg' ? (v * 180) / Math.PI : v)

/** Each entry is [arity, implementation]. Trig respects the angle mode. */
const FUNCTIONS: Record<string, { arity: number; fn: (args: number[], mode: AngleMode) => number }> =
  {
    sin: { arity: 1, fn: ([a], m) => Math.sin(toRad(a!, m)) },
    cos: { arity: 1, fn: ([a], m) => Math.cos(toRad(a!, m)) },
    tan: { arity: 1, fn: ([a], m) => Math.tan(toRad(a!, m)) },
    asin: { arity: 1, fn: ([a], m) => fromRad(Math.asin(a!), m) },
    acos: { arity: 1, fn: ([a], m) => fromRad(Math.acos(a!), m) },
    atan: { arity: 1, fn: ([a], m) => fromRad(Math.atan(a!), m) },
    atan2: { arity: 2, fn: ([a, b], m) => fromRad(Math.atan2(a!, b!), m) },
    sinh: { arity: 1, fn: ([a]) => Math.sinh(a!) },
    cosh: { arity: 1, fn: ([a]) => Math.cosh(a!) },
    tanh: { arity: 1, fn: ([a]) => Math.tanh(a!) },
    // `log` is base 10 — the science convention, and what the keypad shows.
    log: { arity: 1, fn: ([a]) => Math.log10(a!) },
    ln: { arity: 1, fn: ([a]) => Math.log(a!) },
    log2: { arity: 1, fn: ([a]) => Math.log2(a!) },
    sqrt: { arity: 1, fn: ([a]) => Math.sqrt(a!) },
    cbrt: { arity: 1, fn: ([a]) => Math.cbrt(a!) },
    abs: { arity: 1, fn: ([a]) => Math.abs(a!) },
    exp: { arity: 1, fn: ([a]) => Math.exp(a!) },
    floor: { arity: 1, fn: ([a]) => Math.floor(a!) },
    ceil: { arity: 1, fn: ([a]) => Math.ceil(a!) },
    round: { arity: 1, fn: ([a]) => Math.round(a!) },
    sign: { arity: 1, fn: ([a]) => Math.sign(a!) },
    min: { arity: 2, fn: ([a, b]) => Math.min(a!, b!) },
    max: { arity: 2, fn: ([a, b]) => Math.max(a!, b!) },
    pow: { arity: 2, fn: ([a, b]) => Math.pow(a!, b!) },
  }

export const FUNCTION_NAMES = Object.keys(FUNCTIONS)

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new ExpressionError('Factorial needs a whole number that is not negative')
  }
  if (n > 170) return Infinity // 171! exceeds Number.MAX_VALUE
  let out = 1
  for (let k = 2; k <= n; k++) out *= k
  return out
}

// ---------------------------------------------------------------------------
// Parser — builds a tree of closures
// ---------------------------------------------------------------------------

type Node = (vars: Record<string, number>, mode: AngleMode) => number

export function compile(source: string): Compiled {
  const tokens = tokenise(source)
  const seen = new Set<string>()
  let pos = 0

  const peek = () => tokens[pos]
  const atOp = (value: string) => {
    const t = peek()
    return t?.kind === 'op' && t.value === value
  }
  const eat = (value: string) => {
    if (!atOp(value)) throw new ExpressionError(`Expected “${value}”`)
    pos++
  }

  function parseExpression(): Node {
    let left = parseTerm()
    for (;;) {
      if (atOp('+')) {
        pos++
        const right = parseTerm()
        const l = left
        left = (v, m) => l(v, m) + right(v, m)
      } else if (atOp('-')) {
        pos++
        const right = parseTerm()
        const l = left
        left = (v, m) => l(v, m) - right(v, m)
      } else return left
    }
  }

  function parseTerm(): Node {
    let left = parseUnary()
    for (;;) {
      if (atOp('*')) {
        pos++
        const right = parseUnary()
        const l = left
        left = (v, m) => l(v, m) * right(v, m)
      } else if (atOp('/')) {
        pos++
        const right = parseUnary()
        const l = left
        left = (v, m) => l(v, m) / right(v, m)
      } else if (atOp('%')) {
        pos++
        const right = parseUnary()
        const l = left
        left = (v, m) => l(v, m) % right(v, m)
      } else return left
    }
  }

  // Unary minus sits *above* '^' so that -2^2 is -(2^2) = -4, which is the
  // mathematical convention (and what Desmos does), not (-2)^2 = 4.
  function parseUnary(): Node {
    if (atOp('-')) {
      pos++
      const operand = parseUnary()
      return (v, m) => -operand(v, m)
    }
    if (atOp('+')) {
      pos++
      return parseUnary()
    }
    if (atOp('√')) {
      pos++
      const operand = parseUnary()
      return (v, m) => Math.sqrt(operand(v, m))
    }
    return parsePower()
  }

  function parsePower(): Node {
    const base = parsePostfix()
    if (atOp('^')) {
      pos++
      // Right associative, and the exponent may be signed: 2^-3, 2^3^2.
      const exponent = parseUnary()
      return (v, m) => Math.pow(base(v, m), exponent(v, m))
    }
    return base
  }

  function parsePostfix(): Node {
    let node = parsePrimary()
    while (atOp('!')) {
      pos++
      const inner = node
      node = (v, m) => factorial(inner(v, m))
    }
    return node
  }

  function parsePrimary(): Node {
    const token = peek()
    if (!token) throw new ExpressionError('The expression ends too early')

    if (token.kind === 'number') {
      pos++
      const { value } = token
      return () => value
    }

    if (token.kind === 'op' && token.value === '(') {
      pos++
      const inner = parseExpression()
      eat(')')
      return inner
    }

    if (token.kind === 'name') {
      pos++
      const name = token.value

      if (atOp('(')) {
        const spec = FUNCTIONS[name]
        if (!spec) throw new ExpressionError(`Unknown function “${name}”`)
        pos++
        const args: Node[] = []
        if (!atOp(')')) {
          args.push(parseExpression())
          while (atOp(',')) {
            pos++
            args.push(parseExpression())
          }
        }
        eat(')')
        if (args.length !== spec.arity) {
          throw new ExpressionError(
            `${name}() takes ${spec.arity} argument${spec.arity === 1 ? '' : 's'}, got ${args.length}`,
          )
        }
        return (v, m) => spec.fn(args.map((a) => a(v, m)), m)
      }

      if (name in CONSTANTS) {
        const value = CONSTANTS[name]!
        return () => value
      }

      // Anything else is a free variable, resolved at evaluation time.
      seen.add(name)
      return (v) => {
        const value = v[name]
        if (value === undefined) throw new ExpressionError(`“${name}” has no value`)
        return value
      }
    }

    throw new ExpressionError(`Unexpected “${token.value}”`)
  }

  const root = parseExpression()
  if (pos < tokens.length) {
    const rest = tokens[pos]!
    throw new ExpressionError(`Unexpected “${rest.value}” after a complete expression`)
  }

  return {
    evaluate: (ctx) => root(ctx?.vars ?? {}, ctx?.angleMode ?? 'rad'),
    variables: [...seen],
  }
}

/** Convenience for one-shot evaluation; throws ExpressionError on bad input. */
export function evaluate(source: string, ctx?: EvalContext): number {
  return compile(source).evaluate(ctx)
}
