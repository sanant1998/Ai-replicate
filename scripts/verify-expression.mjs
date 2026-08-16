// Unit checks for the expression engine that the calculator and grapher share.
// Run with: npm run verify:expression
import { compile, evaluate, ExpressionError } from '../src/lib/expression.ts'

let failed = 0
const near = (a, b) => Math.abs(a - b) < 1e-9

function eq(expr, expected, ctx) {
  let got
  try {
    got = evaluate(expr, ctx)
  } catch (err) {
    console.log(`  x ${expr}  threw ${err.message}`)
    failed++
    return
  }
  if (near(got, expected)) console.log(`  . ${expr} = ${got}`)
  else {
    console.log(`  x ${expr}  expected ${expected}, got ${got}`)
    failed++
  }
}

function throws(expr) {
  try {
    evaluate(expr)
    console.log(`  x ${expr}  should have thrown`)
    failed++
  } catch (err) {
    if (err instanceof ExpressionError) console.log(`  . ${expr}  rejected: ${err.message}`)
    else {
      console.log(`  x ${expr}  threw the wrong error type: ${err}`)
      failed++
    }
  }
}

console.log('\nprecedence & associativity')
eq('2+3*4', 14)
eq('(2+3)*4', 20)
eq('2^3^2', 512) // right associative
eq('-2^2', -4) // unary minus binds looser than ^
eq('2^-2', 0.25)
eq('10-2-3', 5) // left associative
eq('100/10/2', 5)
eq('7%3', 1)

console.log('\nnumbers')
eq('.5+1', 1.5)
eq('2.5e2', 250)
eq('1e-3', 0.001)

console.log('\nfunctions & constants')
eq('sqrt(16)', 4)
eq('log(1000)', 3) // base 10
eq('ln(e)', 1)
eq('abs(-7)', 7)
eq('max(3,9)', 9)
eq('pow(2,10)', 1024)
eq('pi', Math.PI)
eq('5!', 120)
eq('3!+1', 7)

console.log('\nangle modes')
eq('sin(90)', 1, { angleMode: 'deg' })
eq('cos(0)', 1, { angleMode: 'deg' })
eq('sin(pi/2)', 1, { angleMode: 'rad' })
eq('asin(1)', 90, { angleMode: 'deg' })

console.log('\nunicode input')
eq('2×3', 6)
eq('10÷4', 2.5)
eq('√9', 3)

console.log('\nvariables')
eq('x^2+1', 10, { vars: { x: 3 } })
eq('2*x*y', 24, { vars: { x: 3, y: 4 } })

console.log('\nrejects bad input')
throws('2+')
throws('(1+2')
throws('nope(3)')
throws('2 3')
throws('x')
throws('$')

console.log('\ncompile once, evaluate many')
const f = compile('x^2')
const pts = [0, 1, 2, 3].map((x) => f.evaluate({ vars: { x } }))
if (String(pts) === '0,1,4,9') console.log('  . reusable across points:', pts.join(','))
else {
  console.log('  x reuse broken:', pts.join(','))
  failed++
}
if (String(f.variables) === 'x') console.log('  . reports its free variables')
else {
  console.log('  x variables wrong:', f.variables)
  failed++
}

console.log(failed ? `\nFAILED (${failed})` : '\nALL EXPRESSION CHECKS PASSED')
process.exit(failed ? 1 : 0)
