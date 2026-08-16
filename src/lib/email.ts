import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Transport-agnostic mail sender. Three backends, tried in this order:
 *
 *   SMTP_HOST      — any SMTP server, including Mailtrap in development
 *   RESEND_API_KEY — Resend's HTTP API
 *   neither        — the message is logged instead of sent
 *
 * The console fallback is what makes password reset and email confirmation
 * exercisable with no mail account at all; it is not a delivery mechanism, and
 * `sendPasswordReset` failing silently in production is exactly the bug it
 * would cause, so configure one of the two above before real users arrive.
 */
export type Mail = {
  to: string
  subject: string
  text: string
}

const FROM = process.env.EMAIL_FROM ?? 'PaperPath <no-reply@paperpath.dev>'

/**
 * Built once and reused. nodemailer keeps a connection pool behind the
 * transporter, so constructing one per email would open a fresh SMTP session
 * (and a fresh TLS handshake) every time.
 */
let transporter: Transporter | null = null

function smtpTransport(): Transporter | null {
  const host = process.env.SMTP_HOST
  if (!host) return null
  if (transporter) return transporter

  const port = Number(process.env.SMTP_PORT ?? 587)

  transporter = nodemailer.createTransport({
    host,
    port,
    // Port 465 speaks TLS from the first byte. Everything else (587, 2525, 25)
    // starts in the clear and upgrades via STARTTLS, which nodemailer does on
    // its own when the server advertises it.
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
      : undefined,
    // nodemailer waits indefinitely by default. Sends run outside the response
    // now, but a serverless invocation is still billed and capped while they
    // do, so an unreachable host has to fail rather than hold the slot open.
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  })
  return transporter
}

async function deliver(mail: Mail): Promise<void> {
  const smtp = smtpTransport()
  if (smtp) {
    await smtp.sendMail({ from: FROM, to: mail.to, subject: mail.subject, text: mail.text })
    return
  }

  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn(
      `[email] No provider configured — not sent.\n  to: ${mail.to}\n  subject: ${mail.subject}\n  ${mail.text}`,
    )
    return
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
  })

  if (!res.ok) {
    throw new Error(`Email provider rejected the message (${res.status}): ${await res.text()}`)
  }
}

export async function sendEmailVerification(to: string, verifyUrl: string) {
  await deliver({
    to,
    subject: 'Confirm your email for PaperPath',
    text: [
      'Welcome to PaperPath.',
      '',
      `Confirm this address within 24 hours to unlock your full daily allowance of AI tutor questions:\n${verifyUrl}`,
      '',
      'If you did not create this account, ignore this email — nothing further will happen.',
    ].join('\n'),
  })
}

export async function sendPasswordReset(to: string, resetUrl: string) {
  await deliver({
    to,
    subject: 'Reset your PaperPath password',
    text: [
      'Someone asked to reset the password on your PaperPath account.',
      '',
      `Open this link within an hour to choose a new one:\n${resetUrl}`,
      '',
      'If that was not you, ignore this email — your password has not changed.',
    ].join('\n'),
  })
}
