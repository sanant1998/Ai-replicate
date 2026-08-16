/**
 * Matrix operations for the matrix calculator.
 *
 * Determinant and inverse both use Gaussian elimination with partial pivoting
 * rather than the cofactor expansion taught in class: cofactors are O(n!) and
 * lose precision badly, while pivoting keeps the arithmetic stable. The answer
 * is the same one the textbook method gives.
 */

export type Matrix = number[][]

export class MatrixError extends Error {}

export const rows = (m: Matrix) => m.length
export const cols = (m: Matrix) => m[0]?.length ?? 0

function sameShape(a: Matrix, b: Matrix, operation: string) {
  if (rows(a) !== rows(b) || cols(a) !== cols(b)) {
    throw new MatrixError(
      `${operation} needs matrices of the same size — A is ${rows(a)}×${cols(a)}, B is ${rows(b)}×${cols(b)}`,
    )
  }
}

function requireSquare(m: Matrix, operation: string) {
  if (rows(m) !== cols(m)) {
    throw new MatrixError(`${operation} only works on a square matrix — this one is ${rows(m)}×${cols(m)}`)
  }
}

export function add(a: Matrix, b: Matrix): Matrix {
  sameShape(a, b, 'Addition')
  return a.map((row, i) => row.map((value, j) => value + b[i]![j]!))
}

export function subtract(a: Matrix, b: Matrix): Matrix {
  sameShape(a, b, 'Subtraction')
  return a.map((row, i) => row.map((value, j) => value - b[i]![j]!))
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (cols(a) !== rows(b)) {
    throw new MatrixError(
      `To multiply, A's columns must match B's rows — A is ${rows(a)}×${cols(a)}, B is ${rows(b)}×${cols(b)}`,
    )
  }
  const out: Matrix = Array.from({ length: rows(a) }, () => new Array(cols(b)).fill(0))
  for (let i = 0; i < rows(a); i++) {
    for (let k = 0; k < cols(a); k++) {
      const aik = a[i]![k]!
      if (aik === 0) continue
      for (let j = 0; j < cols(b); j++) out[i]![j]! += aik * b[k]![j]!
    }
  }
  return out
}

export function scale(m: Matrix, k: number): Matrix {
  return m.map((row) => row.map((value) => value * k))
}

export function transpose(m: Matrix): Matrix {
  return Array.from({ length: cols(m) }, (_, j) => Array.from({ length: rows(m) }, (_, i) => m[i]![j]!))
}

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
}

export function determinant(m: Matrix): number {
  requireSquare(m, 'The determinant')
  const n = rows(m)
  if (n === 0) throw new MatrixError('The matrix is empty')

  const a = m.map((row) => [...row])
  let det = 1

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) return 0 // a zero column ⇒ singular

    if (pivot !== col) {
      ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
      det = -det // each row swap flips the sign
    }

    det *= a[col]![col]!
    for (let r = col + 1; r < n; r++) {
      const factor = a[r]![col]! / a[col]![col]!
      if (factor === 0) continue
      for (let c = col; c < n; c++) a[r]![c]! -= factor * a[col]![c]!
    }
  }

  return det
}

export function inverse(m: Matrix): Matrix {
  requireSquare(m, 'The inverse')
  const n = rows(m)
  const a = m.map((row) => [...row])
  const out = identity(n)

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) {
      throw new MatrixError('This matrix is singular — its determinant is 0, so it has no inverse')
    }

    if (pivot !== col) {
      ;[a[col], a[pivot]] = [a[pivot]!, a[col]!]
      ;[out[col], out[pivot]] = [out[pivot]!, out[col]!]
    }

    const p = a[col]![col]!
    for (let c = 0; c < n; c++) {
      a[col]![c]! /= p
      out[col]![c]! /= p
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const factor = a[r]![col]!
      if (factor === 0) continue
      for (let c = 0; c < n; c++) {
        a[r]![c]! -= factor * a[col]![c]!
        out[r]![c]! -= factor * out[col]![c]!
      }
    }
  }

  return out
}

export function rank(m: Matrix): number {
  const a = m.map((row) => [...row])
  const rowCount = rows(a)
  const colCount = cols(a)
  let rowIndex = 0
  let found = 0

  for (let col = 0; col < colCount && rowIndex < rowCount; col++) {
    let pivot = rowIndex
    for (let r = rowIndex + 1; r < rowCount; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) continue

    ;[a[rowIndex], a[pivot]] = [a[pivot]!, a[rowIndex]!]
    for (let r = rowIndex + 1; r < rowCount; r++) {
      const factor = a[r]![col]! / a[rowIndex]![col]!
      for (let c = col; c < colCount; c++) a[r]![c]! -= factor * a[rowIndex]![c]!
    }
    rowIndex++
    found++
  }

  return found
}

export function trace(m: Matrix): number {
  requireSquare(m, 'The trace')
  return m.reduce((sum, row, i) => sum + row[i]!, 0)
}

/**
 * Elimination leaves values like 3.0000000000000004. Snapping to a clean number
 * when we are within floating-point noise of one keeps results readable without
 * pretending to a precision the arithmetic does not have.
 */
export function presentNumber(value: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? '—' : value > 0 ? '∞' : '-∞'
  const snapped = Math.abs(value - Math.round(value)) < 1e-9 ? Math.round(value) : value
  if (Number.isInteger(snapped)) return String(snapped === 0 ? 0 : snapped) // avoid "-0"
  return String(Number(snapped.toPrecision(10)))
}
