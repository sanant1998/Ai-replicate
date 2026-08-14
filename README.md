# PaperPath

A rebuild of a chapter-wise video learning platform for Indian school boards (CBSE / ICSE / state boards, Class 5–12), built on **Next.js 16 + Tailwind v4 + Prisma 7 + Postgres**.

Everything below works end to end:

| Feature | Where |
| --- | --- |
| Course catalog, search & chapter browsing | `/academic` — class + subject filters, chapter search, free-vs-locked state |
| Video lecture player | `/learn/[topicId]` — HLS playback through signed, expiring, account-bound tickets; resume position; completion |
| AI tutor | `/tutor` — streaming chat scoped to your chapter, or `?mode=career` for career guidance |
| Chapter quizzes | `/quiz/[chapterId]` — server-side marking, weighted marks, explanations revealed only after submitting |
| Study tools | `/tools` — AI formula sheet, practice generator, doubt solver; one credit each |
| Notes & bookmarks | `/notes` — timestamped notes that jump back into the video, saved chapters |
| Auth, subscriptions, paywall, credits | `/login`, `/checkout`, `/profile` — board/class selection, password reset, Razorpay checkout, daily AI credits |
| Content admin | `/admin` — CRUD for chapters, topics and quiz questions, gated on the `ADMIN` role |

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
      tools/                # formula sheet / practice / doubt solver
      notes/                # notes + saved chapters
      checkout/             # Razorpay order creation (server action)
      admin/                # ADMIN-only CRUD for chapters, topics, questions
      performance/ history/ profile/ terms/ privacy/ pricing/
    api/
      progress/route.ts     # POST watch position, re-checks entitlement
      tutor/route.ts        # SSE stream from Anthropic, spends a credit
      video/[topicId]/      # verifies a playback ticket, 302s to the CDN
      payments/razorpay/webhook/   # the ONLY path that grants a subscription
    login/                  # credentials auth (server actions)
    forgot-password/ reset-password/
  components/               # Sidebar, VideoPlayer, TutorChat, NotesPanel, LegalPage, icons
  lib/
    prisma.ts               # client singleton on the pg driver adapter
    session.ts              # JWT session cookie (jose)
    access.ts               # entitlement rules — the single source of truth
    entitle.ts              # the only place a Subscription is created
    video.ts                # signed, expiring, account-bound playback tickets
    razorpay.ts             # order creation + webhook signature verification
    quiz.ts                 # server-side marking
    rate-limit.ts           # fixed-window limiter
    credits.ts email.ts reset.ts ai.ts admin.ts format.ts
prisma/
  schema.prisma
  migrations/
  seed.ts                   # catalog + demo accounts
  questions.ts              # hand-written chapter quizzes
  syllabus.ts               # NCERT chapter listings for classes 6, 7, 9, 10
scripts/                    # browser suites, payment suite, mock Anthropic server
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

1. **Entitlement** — `src/lib/access.ts` is the only source of truth. The player, `/api/progress`, `/api/tutor`, `/api/video`, the quiz and the tools all call it. A forged id gets a 403, not content.
2. **Playback tickets** — `src/lib/video.ts` signs `{topicId, userId, expiry}` with `AUTH_SECRET`. The player never receives a CDN URL; it plays through `/api/video/[topicId]`, which verifies the ticket *and* re-checks entitlement, so a lapsed subscription cuts playback mid-session. Tickets expire in 4 hours and are bound to the account they were issued to.
3. **Payment** — `src/lib/entitle.ts` is the only place a `Subscription` is created, and it is called only from the signature-verified Razorpay webhook. The `Payment` row owns the subscription through a unique `subscriptionId`, so a retried webhook grants exactly once.

Rate limits sit on the tutor, progress, video, tools, login, signup and password-reset paths (`src/lib/rate-limit.ts`). The store is per-process; swap `hit()` for a Redis `INCR`/`EXPIRE` before running more than one instance.

---

## Before you ship this

- **Set the Razorpay keys.** With them unset, `/checkout` refuses to sell rather than granting anything. `ALLOW_MOCK_CHECKOUT=1` restores the grant-without-charging path, and is ignored in production builds. You still need to register the webhook URL (`/api/payments/razorpay/webhook`) in the Razorpay dashboard.
- **Swap the video CDN.** Playback is ticketed, but `upstreamUrl()` in `src/lib/video.ts` is an identity function — plug your provider's own signing (CloudFront, Mux, Bunny) into it, and replace `DEMO_HLS` in `prisma/seed.ts`. Ticketing stops a shared link; it does not stop screen recording, which needs DRM.
- **Wire an email provider.** `src/lib/email.ts` uses Resend if `RESEND_API_KEY` is set, and otherwise logs the reset link to the server console. Password reset does not work for real users until this is set.
- **Content is partly real.** Class 8 CBSE has full chapter and topic data. Classes 6, 7, 9 and 10 carry real NCERT chapter names but placeholder topics and no video. Classes 5, 11 and 12 are empty shells. NCERT rationalised the syllabus from 2023–24 — check `prisma/syllabus.ts` against the edition your students use.
- **Have a lawyer read `/terms` and `/privacy`.** They describe what the app actually does, which is the right starting point, but your users are minors: a signup checkbox is very likely not "verifiable parental consent" under the DPDP Act 2023.
- **Only 29 quiz questions exist**, across 6 chapters. Write more in `/admin`, or lean on the practice generator in `/tools`.

---

## Verification

```bash
npm run build && npm start                              # terminal 1
npx playwright install chromium                         # once
npm run db:seed                                         # suites consume credits — reseed first
VERIFY_BASE=http://127.0.0.1:3000 npm run verify        # 33 browser checks
npm run verify:payments                                 # webhook signature + idempotency
```

For the tutor and tools without burning API credits:

```bash
npm run mock:anthropic                                  # fake Messages endpoint on :4010
# with ANTHROPIC_API_KEY=mock ANTHROPIC_BASE_URL=http://127.0.0.1:4010
npm run verify:tutor
```

The mock answers streaming and non-streaming requests, so it covers both the tutor route and the Tools pages.

Browser checks cover: catalog rendering and stats, free-chapter playback while signed out, locked chapters showing the paywall, `/api/progress` returning 401 anonymously and 200 when entitled, login/logout, checkout refusing to grant when payments are unconfigured, wrong-password handling, and mobile layout overflow. Screenshots land in `.verify-shots/`.
