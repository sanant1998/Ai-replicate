import 'server-only'

/**
 * What a receipt is allowed to claim.
 *
 * India requires a seller registered for GST to issue a tax invoice carrying
 * their GSTIN, and forbids anyone else from showing a tax component at all —
 * collecting "GST" without a registration is an offence, not a formatting
 * choice. So the tax breakdown is opt-in and gated on GSTIN being set: with it,
 * this issues a tax invoice; without it, a plain payment receipt that says only
 * what was paid.
 *
 * Prices are stored and charged tax-inclusive, which is what /terms tells
 * students ("prices shown include applicable taxes"), so the breakdown works
 * backwards out of the total rather than adding to it.
 */
export type SellerDetails = {
  name: string
  address: string | null
  gstin: string | null
  /** The state whose GST applies, for the place-of-supply line. */
  state: string | null
}

export function seller(): SellerDetails {
  return {
    name: process.env.SELLER_LEGAL_NAME ?? 'PaperPath',
    address: process.env.SELLER_ADDRESS ?? null,
    gstin: process.env.SELLER_GSTIN ?? null,
    state: process.env.SELLER_STATE ?? null,
  }
}

/**
 * The GST rate applied to a tax invoice, as a percentage.
 *
 * Deliberately not hard-coded to 18: online educational content is rated
 * differently depending on what exactly is being sold and to whom, and that is
 * the seller's accountant's call rather than this file's. 18 is the default
 * because it is the rate most SaaS-shaped sales land on, and a wrong default is
 * better caught by an accountant reading a receipt than by a silent zero.
 */
export function gstPercent(): number {
  const raw = process.env.GST_PERCENT
  if (raw === undefined || raw.trim() === '') return 18
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return 18
  return parsed
}

export type TaxBreakdown = {
  /** Everything in paise, so nothing is ever rounded twice. */
  totalPaise: number
  taxablePaise: number
  taxPaise: number
  percent: number
}

/**
 * Splits a tax-inclusive total into its taxable value and its tax.
 *
 * The taxable value is rounded and the tax is the remainder, rather than both
 * being rounded independently — otherwise the two lines do not add up to the
 * amount actually charged, which is the one number the student can check
 * against their bank statement.
 */
export function splitInclusiveTax(totalPaise: number, percent = gstPercent()): TaxBreakdown {
  if (percent <= 0) {
    return { totalPaise, taxablePaise: totalPaise, taxPaise: 0, percent: 0 }
  }
  const taxablePaise = Math.round(totalPaise / (1 + percent / 100))
  return { totalPaise, taxablePaise, taxPaise: totalPaise - taxablePaise, percent }
}

/**
 * How long after paying a student may ask for their money back.
 *
 * Seven days is what /terms promises. It is read from one place so the promise
 * and the code that honours it cannot drift apart.
 */
export const REFUND_WINDOW_DAYS = 7

export function refundWindowClosesAt(paidAt: Date): Date {
  const closes = new Date(paidAt)
  closes.setDate(closes.getDate() + REFUND_WINDOW_DAYS)
  return closes
}

export function withinRefundWindow(paidAt: Date, now = new Date()): boolean {
  return now < refundWindowClosesAt(paidAt)
}

/**
 * A short human-readable number for the receipt.
 *
 * Built from the payment id rather than a counter: a sequential invoice number
 * would need its own table and a lock, and would leak how many sales have been
 * made. Stable, unique per payment, and short enough to quote over the phone.
 */
export function receiptNumber(paymentId: string, createdAt: Date): string {
  const year = createdAt.getUTCFullYear()
  return `PP-${year}-${paymentId.slice(-8).toUpperCase()}`
}
