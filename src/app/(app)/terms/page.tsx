import { LegalPage, Section } from '@/components/LegalPage'

export const metadata = { title: 'Terms of Use — PaperPath' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="14 August 2026">
      <Section title="1. Who may use PaperPath">
        <p>
          PaperPath is built for school students in India, most of whom are minors. If you are under 18,
          you may use PaperPath only with the knowledge and permission of a parent or legal guardian. By
          creating an account you confirm you have that permission.
        </p>
        <p>
          A parent or guardian who gives permission accepts these terms on the student&apos;s behalf and
          is responsible for the account, including anything bought through it.
        </p>
      </Section>

      <Section title="2. Your account">
        <p>
          Keep your password to yourself. You are responsible for what happens under your account. Tell
          us straight away if you think someone else has got into it.
        </p>
        <p>
          One account is for one student. Sharing a login, or passing on video links so other people can
          watch without paying, is a breach of these terms and we may suspend the account for it.
        </p>
      </Section>

      <Section title="3. Subscriptions, payment and refunds">
        <ul>
          <li>
            Plans are sold for a fixed term of one year from the date the payment is confirmed. Prices
            shown include applicable taxes unless stated otherwise.
          </li>
          <li>
            Payments are processed by Razorpay. We do not receive or store your card or UPI details.
          </li>
          <li>
            Access is granted when Razorpay confirms the payment to us. If money leaves your account but
            access does not appear within an hour, contact us with the payment reference.
          </li>
          <li>
            <strong>Refunds:</strong> you may cancel within 7 days of purchase for a full refund,
            provided you have watched no more than 2 hours of paid content. After that the subscription
            runs to the end of its term. Refunds are returned to the original payment method within 7
            working days of approval.
          </li>
          <li>
            <strong>How to ask:</strong> open your profile, find the payment under “Payments”, and use
            “Ask for a refund”. You will get a receipt for every payment on the same page, and an
            answer by email.
          </li>
          <li>Chapter 1 of every subject stays free and needs no subscription.</li>
        </ul>
      </Section>

      <Section title="4. Using the AI tutor">
        <p>
          The AI tutor is a study aid. It explains, prompts and quizzes — it can also be wrong. Check
          anything important against your textbook or your teacher before you rely on it, especially in
          an exam context.
        </p>
        <p>
          Do not use the tutor to have graded homework, assignments or exams completed for you. Your
          school&apos;s rules on academic honesty apply, and breaking them is on you, not on us.
        </p>
        <p>
          Each account gets a daily allowance of tutor messages. We may adjust the allowance, and we may
          rate-limit or suspend accounts that use the tutor abusively or automatically.
        </p>
      </Section>

      <Section title="5. Content and licence">
        <p>
          The lectures, notes, questions and other material on PaperPath belong to us or to our licensors.
          Your subscription buys you a personal, non-transferable right to watch and study them while it
          is active.
        </p>
        <p>
          You may not download, record, re-upload, resell or publicly show the content, or strip out any
          technical protection on it. Notes you write yourself remain yours.
        </p>
      </Section>

      <Section title="6. What we do not promise">
        <p>
          We work to keep PaperPath available and accurate, but we do not guarantee uninterrupted service,
          nor any particular exam result. Syllabus coverage follows the board&apos;s published curriculum
          as we understand it; always confirm the current syllabus with your board.
        </p>
      </Section>

      <Section title="7. Ending your access">
        <p>
          You can stop using PaperPath at any time and ask us to delete your account. We may suspend or end
          access if these terms are broken — for serious breaches, immediately. If we end your access
          without cause, we refund the unused part of your subscription.
        </p>
      </Section>

      <Section title="8. Governing law and contact">
        <p>
          These terms are governed by the laws of India, and the courts at the place of our registered
          office have jurisdiction.
        </p>
        <p>
          Questions about these terms: <strong>legal@paperpath.dev</strong>.
        </p>
      </Section>

      <Section title="Before you launch" tone="warn">
        <p>
          This document is drafted to be substantive rather than a placeholder, but it has not been
          reviewed by a lawyer. Before taking real payments, have Indian counsel check it against the
          Consumer Protection (E-Commerce) Rules 2020, your actual refund practice, your registered
          entity details and jurisdiction, and the DPDP Act 2023 obligations that apply because your
          users are children.
        </p>
      </Section>
    </LegalPage>
  )
}
