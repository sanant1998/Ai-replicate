# PaperPath

A rebuild of a chapter-wise video learning platform for Indian school syllabuses (Class 5–12), built on **Next.js 16 + Tailwind v4 + Prisma 7 + Postgres**.

The catalog carries **CBSE**. The board editor in `/admin/catalog` adds others; the seed does not, and the site's own copy says CBSE rather than promising boards the content does not cover.

Everything below works end to end:

| Feature | Where |
| --- | --- |
| Course catalog, search & chapter browsing | `/academic` — class + subject filters, chapter search, free-vs-locked state |
| Video lecture player | `/learn/[topicId]` — HLS playback through signed, expiring, account-bound tickets; resume position; completion |
| AI tutor | `/tutor` — streaming chat scoped to your chapter, or `?mode=career` for career guidance; answers in the student's chosen language |
| Chapter quizzes | `/quiz/[chapterId]` — server-side marking, weighted marks, explanations revealed only after submitting |
| Study tools | `/tools` — practice generator, science text editor, graphing & scientific calculators, Ketcher structure editor, periodic table, matrix calculator |
| Notes & bookmarks | `/notes` — timestamped notes that jump back into the video, saved chapters |
| Auth, subscriptions, paywall, credits | `/login`, `/checkout`, `/profile` — board/class selection, password reset, password change, sign-out-everywhere, Razorpay checkout, daily AI credits |
| Receipts & refunds | `/receipt/[paymentId]` — printable receipt or GST tax invoice; refunds requested from `/profile`, decided in `/admin/payments` |
| Parent/guardian consent | `/guardian?token=…` — a link mailed to the address the student gives; `/family` is the read-only view it can unlock |
| Content admin | `/admin` — boards, classes, subjects, courses, chapters, topics and quiz questions; `/admin/payments` for money, both role-gated |

---

## Quick start

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate            # applies prisma/migrations
npm run db:seed               # loads the Class 8 CBSE catalog + demo accounts
npm run dev
```

Open <http://localhost:3000>.

Generate a session secret with `openssl rand -base64 32`.

### Demo accounts

| Email | Password | State |
| --- | --- | --- |
| `student@paperpath.dev` | `password123` | Free tier — chapter 1 of each subject, 5 AI credits/day |
| `premium@paperpath.dev` | `password123` | Class 8 bundle active, 50 AI credits/day |
| `admin@paperpath.dev` | `password123` | `ADMIN` role — can reach `/admin` |

---

## Architecture

```
src/
  app/
    (app)/                  # authenticated shell — sidebar + main column
      academic/             # catalog, filters, chapter search
      learn/[topicId]/      # video player + playlist + notes
      tutor/                # AI tutor chat (chapter-scoped or career mode)
      quiz/[chapterId]/     # attempt, submit, marked result
      tools/                # tool gallery; tools/ holds one panel each
      notes/                # notes + saved chapters
      checkout/             # Razorpay order creation (server action)
      receipt/[paymentId]/  # printable receipt, or a GST invoice once SELLER_GSTIN is set
      family/               # read-only parent view of a linked child
      admin/                # staff CRUD; catalog/, people/ and payments/ are ADMIN-only
      performance/ history/ profile/ terms/ privacy/ pricing/
    api/
      progress/route.ts     # POST watch position, re-checks entitlement
      tutor/route.ts        # SSE stream from OpenAI, spends a credit
      practice/route.ts     # generates practice questions, spends a credit
      video/[topicId]/      # verifies a playback ticket, 302s to the CDN
      payments/razorpay/webhook/   # the ONLY path that grants a subscription
    guardian/               # the consent link a parent follows
    login/                  # credentials auth (server actions)
    forgot-password/ reset-password/
  components/               # Sidebar, VideoPlayer, TutorChat, NotesPanel, LegalPage, icons
  lib/
    prisma.ts               # client singleton on the pg driver adapter
    session.ts              # JWT session cookie (jose)
    access.ts               # entitlement rules — the single source of truth
    entitle.ts              # the only place a Subscription is created
    video.ts                # signed, expiring, account-bound playback tickets
    razorpay.ts             # order creation, refunds, webhook signature verification
    quiz.ts                 # server-side marking
    rate-limit.ts           # fixed-window limiter
    billing.ts              # GST split, receipt numbers, the 7-day refund window
    guardian.ts             # parent/guardian consent tokens
    observability.ts        # the one place errors are reported from
    language.ts             # the languages the tutor answers in
    safe-redirect.ts        # ?next= that cannot leave the site
    credits.ts email.ts reset.ts verify-email.ts admin.ts config.ts format.ts
tests/                      # unit suite — `npm test`, no database needed
prisma/
  schema.prisma
  migrations/
  seed.ts                   # catalog + demo accounts
  questions.ts              # hand-written chapter quizzes
  syllabus.ts               # NCERT chapter listings for classes 6, 7, 9, 10
scripts/                    # browser suites, payment suite, mock OpenAI server
```

### The three rules that govern access

All in `src/lib/access.ts`:

1. **Chapter 1 of every course is free** — including for signed-out visitors.
2. A **CLASS**-scoped subscription unlocks every course in that class.
3. A **COURSE**-scoped subscription unlocks that one subject.

Every entry point re-checks these server-side. The player page checks before rendering, `/api/progress` checks before writing, and `/api/tutor` checks before injecting chapter context — a client that forges a `topicId` gets a 403, not a lesson.

### Credits

`ensureDailyCredits` tops a user back up to their cap the first time they're seen each UTC day, and writes a `CreditLedger` row so the history is auditable. `spendCredit` uses a conditional `updateMany` (`where: { dailyCredits: { gt: 0 } }`) so two concurrent requests can't both take the last credit.

---

## Notes on the stack

**Prisma 7** moved the connection URL out of `schema.prisma` and into `prisma.config.ts`, and the client now runs on a driver adapter (`@prisma/adapter-pg`) with a WASM query compiler instead of a native engine. If you're used to Prisma 5/6, that's the main surprise.

The baseline migration in `prisma/migrations/` is hand-authored rather than generated (the machine it was built on couldn't reach Prisma's engine CDN). It has been applied to a real Postgres and exercised through the client, but the first time you run `prisma migrate dev` on a schema change, check the generated diff looks sane.

**Fonts** are self-hosted via `@fontsource-variable/nunito` rather than `next/font/google`, so builds don't depend on reaching Google.

**Next.js 16** — `params` and `searchParams` are Promises, Turbopack is the default builder, and `middleware` is now `proxy`. See `AGENTS.md`.

---

## How access is protected

Three layers, each re-checked server-side on every request:

1. **Entitlement** — `src/lib/access.ts` is the only source of truth. The player, `/api/progress`, `/api/tutor`, `/api/video` and the quiz all call it. A forged id gets a 403, not content. (`/tools` is exempt by design: it needs a session, but the tools run wholly in the browser and expose no chapter content.)
2. **Playback tickets** — `src/lib/video.ts` signs `{topicId, userId, expiry}` with `AUTH_SECRET`. The player never receives a CDN URL; it plays through `/api/video/[topicId]`, which verifies the ticket *and* re-checks entitlement, so a lapsed subscription cuts playback mid-session. Tickets expire in 4 hours and are bound to the account they were issued to.
3. **Payment** — `src/lib/entitle.ts` is the only place a `Subscription` is created, and it is called only from the signature-verified Razorpay webhook. It takes a `SELECT … FOR UPDATE` on the payment row before reading whether a grant has already happened, because Razorpay retries a delivery it could not confirm *and* announces one capture on both `payment.captured` and `order.paid` — two HTTP requests that can land together. Reading that flag outside a lock let both grant, and the second `Subscription` was one no `Payment` pointed at: it still unlocked the course, and a refund would never have cancelled it. `verify:payments` fires both events at once and asserts exactly one subscription.

Rate limits sit on the tutor, progress, video, login, signup and password-reset paths (`src/lib/rate-limit.ts`). The store is per-process; swap `hit()` for a Redis `INCR`/`EXPIRE` before running more than one instance.

---

## Deploying to Vercel

Four settings are optional locally and load-bearing in production. None of them
stop the app booting, and each one fails silently — a deployment missing all
four looks completely healthy from the outside. `src/lib/config.ts` audits them
at startup and writes any that are missing to the runtime log, so check there
first if something "works locally".

| Variable | Missing means |
| --- | --- |
| `APP_ORIGIN` | Reset and confirmation links are built from the `Host` header, which the caller controls. Set it to the full origin, e.g. `https://paperpath.example`. |
| `SMTP_HOST…` or `RESEND_API_KEY` | No mail is sent. Reset links go to the server log. |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Rate-limit counters live in process memory, which on serverless resets every cold start — the login, signup and tutor caps stop being caps. |
| `CRON_SECRET` | `/api/cron/maintenance` refuses every request, so the tidy-up below never runs. |
| `ERROR_WEBHOOK_URL` | Runtime failures go to the log and nowhere else. A Razorpay webhook that has been 500ing for a week looks exactly like one that has never fired. Any JSON endpoint works; a Slack incoming webhook renders it as-is. Everything reports through `src/lib/observability.ts`, so swapping that one function for a real APM is the whole migration. |
| `SELLER_GSTIN` | `/receipt/[paymentId]` issues a plain payment receipt instead of a GST tax invoice. Deliberate: showing a tax component with no registration behind it is an offence, not a formatting choice. |

`vercel.json` registers the maintenance cron. Vercel attaches
`Authorization: Bearer $CRON_SECRET` to the invocation automatically once that
variable is set, which is what the route checks. The schedule is daily at 03:00
UTC because the Hobby plan allows one cron a day and rejects the deployment
outright for anything more frequent; on Pro, `0 * * * *` is the better fit — the
job marks lapsed subscriptions `EXPIRED`, closes checkouts abandoned for over a
day, and purges spent tokens. None of that gates access (`getEntitlements`
compares `endsAt` to the clock on every request), but every admin count and
revenue figure drifts without it.

Also set `DIRECT_DATABASE_URL` to the non-pooled endpoint. `prebuild` runs
`prisma migrate deploy`, and DDL through a transaction pooler is unreliable.

---

## Before you ship this

- **Set the Razorpay keys.** With them unset, `/checkout` refuses to sell rather than granting anything. `ALLOW_MOCK_CHECKOUT=1` restores the grant-without-charging path, and is ignored in production builds. You still need to register the webhook URL (`/api/payments/razorpay/webhook`) in the Razorpay dashboard.
- **Swap the video CDN.** Playback is ticketed, but `upstreamUrl()` in `src/lib/video.ts` is an identity function — plug your provider's own signing (CloudFront, Mux, Bunny) into it, and replace `DEMO_HLS` in `prisma/seed.ts`. Ticketing stops a shared link; it does not stop screen recording, which needs DRM.
- **Wire an email provider.** `src/lib/email.ts` uses Resend if `RESEND_API_KEY` is set, and otherwise logs the reset link to the server console. Password reset does not work for real users until this is set.
- **Content is partly real.** Class 8 CBSE has full chapter and topic data. Classes 6, 7, 9 and 10 carry real NCERT chapter names but placeholder topics and no video. Classes 5, 11 and 12 are empty shells. NCERT rationalised the syllabus from 2023–24 — check `prisma/syllabus.ts` against the edition your students use.
- **Have a lawyer read `/terms` and `/privacy`.** They describe what the app actually does, which is the right starting point, but your users are minors. Signup now also mails a consent link to a guardian's address and records who confirmed it (`User.guardianConsentAt`), which is a great deal stronger than a checkbox the child ticks — whether it clears the DPDP Act 2023's bar for *verifiable* consent is still a question for a lawyer, not for this file.
- **Set the receipt details.** `/receipt/[paymentId]` issues a GST tax invoice once `SELLER_GSTIN` is set, and a plain payment receipt otherwise. Showing a tax component without a registration behind it is an offence, so the breakdown is opt-in — but a paid Indian service does need to issue invoices, so set it.
- **101 quiz questions across 24 chapters.** Still not the whole catalog: chapters without a hand-written quiz fall back to the practice generator in `/tools`, which writes questions on demand and costs a tutor credit. Write real ones in `/admin` — those are what get marked and scored.
- **Ketcher is a heavy dependency.** `ketcher-react` plus its WebAssembly chemistry engine is several megabytes. It is loaded with `next/dynamic` and `ssr: false`, so it only downloads when a student opens that one tool — keep it that way.

---

## Verification

Two layers. The unit suite needs nothing but the repo:

```bash
npm test                # tests/ — entitlement, playback tickets, credits, marking,
                        # rate limiting, redirect safety, and the question bank
npm run verify:expression   # the maths parser the calculators share
```

The rest drive a real server, and CI runs all of them:

```bash
npm run build && npm start                              # terminal 1
npx playwright install chromium                         # once
npm run db:seed                                         # suites consume credits — reseed first
VERIFY_BASE=http://localhost:3000 npm run verify        # 33 browser checks
VERIFY_BASE=http://localhost:3000 npm run verify:tools  # 22 checks across the tools
RAZORPAY_WEBHOOK_SECRET=test_webhook_secret npm run verify:payments
VERIFY_BASE=http://localhost:3000 npm run verify:staff  # roles and the admin panel
```

`verify:payments` needs the same `RAZORPAY_WEBHOOK_SECRET` on the server it is
pointed at, or it runs the signature legs and skips the rest. It proves the
webhook grants exactly once — under a retry *and* under `payment.captured`
arriving alongside `order.paid` — and that a full refund cancels what it bought.

`npm run typecheck` runs `next typegen` first. `PageProps`, `LayoutProps` and
`RouteContext` are generated per route into `.next/types`, so on a clean
checkout the typecheck fails on every page without it.

Use `localhost`, not `127.0.0.1` — the dev server treats the other spelling as a
cross-origin host and blocks its own HMR resources, which shows up as 403s in the
console-error check. `next.config.ts` allows both, but only after a restart.

For the tutor without burning API credits:

```bash
npm run mock:openai                                     # fake Chat Completions endpoint on :4010
# with OPENAI_API_KEY=mock OPENAI_BASE_URL=http://127.0.0.1:4010/v1
npm run verify:tutor
```

The mock answers both streaming and non-streaming requests. Note that `verify:tutor`
asserts the mock's exact wording, so it only passes against the mock — not a real key.

Browser checks cover: catalog rendering and stats, free-chapter playback while signed out, locked chapters showing the paywall, `/api/progress` returning 401 anonymously and 200 when entitled, login/logout, checkout refusing to grant when payments are unconfigured, wrong-password handling, and mobile layout overflow. `verify:tools` additionally exercises each tool for real — that `2+3*4` returns 14, that a curve is actually painted to the canvas, that `det A` is right and a shape mismatch is refused, that all 118 elements render, that KaTeX typesets the editor's maths, and that Ketcher mounts. Screenshots land in `.verify-shots/`.
