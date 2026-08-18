import { LegalPage, Section } from '@/components/LegalPage'

export const metadata = { title: 'Privacy Policy — PaperPath' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="14 August 2026">
      <Section title="The short version">
        <p>
          We collect what we need to run your lessons and nothing we don&apos;t. We do not sell your
          data, we do not run advertising, and we do not profile children for marketing. Most of our
          users are minors, so we treat all account data as children&apos;s data by default.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li>
            <strong>Account:</strong> name, email address, password (stored only as a bcrypt hash),
            and the board and class you choose.
          </li>
          <li>
            <strong>Learning activity:</strong> which topics you watched and how far through, which
            topics you completed, quiz attempts and scores, notes and bookmarks you create.
          </li>
          <li>
            <strong>AI tutor:</strong> the messages you send and the replies you receive, kept so your
            conversation is still there when you come back.
          </li>
          <li>
            <strong>Payments:</strong> the amount, the plan and the payment reference from Razorpay. We
            never see or store your card, UPI or bank details.
          </li>
          <li>
            <strong>Technical:</strong> a signed session cookie, and short-lived request counters used
            to rate-limit abuse.
          </li>
        </ul>
        <p>
          We do not ask for your date of birth, phone number, address, photograph, or location, and you
          should not put any of those into the AI tutor.
        </p>
      </Section>

      <Section title="Why we hold it">
        <p>
          To sign you in, to show your place in a lesson, to scope the AI tutor to the right chapter, to
          honour a subscription you paid for, and to keep the service from being abused. That is the
          whole list.
        </p>
      </Section>

      <Section title="Who else sees it">
        <ul>
          <li>
            <strong>OpenAI</strong> processes AI tutor messages to generate replies. Your name and
            class are included so the tutor can address you appropriately.
          </li>
          <li>
            <strong>Razorpay</strong> processes payments and holds the payment instrument details.
          </li>
          <li>
            <strong>Our hosting and database providers</strong> store the data described above.
          </li>
        </ul>
        <p>
          Each is bound to use the data only to provide their service to us. We do not share your data
          with anyone else, and we never sell it.
        </p>
      </Section>

      <Section title="Children and parental consent">
        <p>
          Under India&apos;s Digital Personal Data Protection Act 2023, processing a child&apos;s
          personal data requires verifiable consent from a parent or legal guardian, and prohibits
          tracking, behavioural monitoring and targeted advertising directed at children.
        </p>
        <p>
          At signup we require a confirmation that a parent or guardian has given permission, and we
          record when that was given. We run no advertising and no behavioural tracking of any kind.
        </p>
        <p>
          A student can also give us their parent or guardian&apos;s email address, at signup or later
          from their profile. We email that address once, explaining what we store, and record the
          permission only when the guardian follows the link themselves.
        </p>
        <p>
          A guardian who confirms may choose to open an account of their own and see how their child
          is getting on. That view is deliberately limited to lessons watched, quiz scores and how
          many tutor sessions there have been — <strong>not</strong> the contents of those
          conversations, and not the child&apos;s notes. A tutor a parent is reading over the
          shoulder of is not somewhere a child will admit they do not understand something.
        </p>
        <p>
          A parent or guardian may write to <strong>privacy@paperpath.dev</strong> at any time to see what
          we hold about their child, correct it, or have the account and its data deleted.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Account and learning data is kept while the account is open. Ask us to delete the account and
          we remove it within 30 days, except records we are legally required to retain — chiefly
          payment records, which tax law requires us to keep for eight years.
        </p>
        <p>Password reset links expire after one hour and are single-use.</p>
      </Section>

      <Section title="Your rights">
        <p>
          You, or your parent or guardian, can ask us for a copy of your data, ask us to correct it, ask
          us to delete it, or withdraw consent. Write to <strong>privacy@paperpath.dev</strong> and we will
          respond within 30 days. If you are not satisfied, you may complain to the Data Protection
          Board of India.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Passwords are hashed, never stored in plain text. Sessions use signed cookies. Video is served
          through short-lived, account-bound links rather than public URLs. No system is perfect; if we
          ever have a breach affecting your data we will notify you and the Data Protection Board as the
          law requires.
        </p>
      </Section>

      <Section title="Before you launch" tone="warn">
        <p>
          This policy describes what the application actually does today, which is the honest starting
          point — but it is not legal advice. Before collecting real user data, have Indian counsel
          confirm your DPDP Act 2023 position, in particular what counts as{' '}
          <em>verifiable</em> parental consent for your audience (a checkbox at signup is very likely
          not sufficient on its own), and register a Data Protection Officer contact if you need one.
        </p>
      </Section>
    </LegalPage>
  )
}
