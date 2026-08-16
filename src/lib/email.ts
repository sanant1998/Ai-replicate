import 'server-only'

/**
 * Transport-agnostic mail sender.
 *
 * There is no provider wired in by default, because picking one is a deployment
 * decision. Set RESEND_API_KEY to use Resend, or replace `deliver()` with your
 * own SMTP / SES / Postmark call — nothing else in the app needs to change.
 *
 * With no provider configured the message is logged instead of sent, so the
 * password reset flow is exercisable in development without an email account.
 */
export type Mail = {
  to: string
  subject: string
  text: string
}

const FROM = process.env.EMAIL_FROM ?? 'PaperPath <no-reply@paperpath.dev>'

async function deliver(mail: Mail): Promise<void> {
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
