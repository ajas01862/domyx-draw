# Domyx ActivityDesk

Domyx ActivityDesk is a React + TypeScript platform foundation for random draws, events, chitty group management and live rooms. It uses Supabase for authentication, PostgreSQL, Row Level Security, Realtime and Edge Functions. The static frontend is deployed with GitHub Pages.

> **Implementation status:** This repository contains a working public landing page, email/password and Google OAuth UI, authenticated dashboard, database-backed event creation and registration, and a server-side random draw flow. Chitty management, live-room host UI, comment-provider integrations, payment processing and full administration workflows are schema/UI foundations and are not yet complete. Do not advertise those modules as production-ready until their workflows and tests are implemented.

## Stack

- React 18, TypeScript and Vite
- Vanilla CSS (no Tailwind)
- Supabase Auth, PostgreSQL, RLS, Realtime and Edge Functions
- GitHub Actions and GitHub Pages
- React Router browser URLs with a GitHub Pages `404.html` fallback for direct links and refresh support

## 1. Create and configure Supabase

1. Create a project at [Supabase](https://supabase.com/).
2. Open **Project Settings → API** and copy the Project URL and anon/publishable key.
3. In **SQL Editor**, run `supabase/migrations/202611100001_initial_schema.sql`.
4. Then run `supabase/migrations/202611110001_fix_draw_completion.sql` to install the corrected atomic draw-completion function.
5. Confirm both migrations completed and the tables, function and RLS policies exist.
6. In **Authentication → URL Configuration**, add your local and production redirect URLs, such as `http://localhost:5173/**` and `https://YOUR_GITHUB_USERNAME.github.io/**`.
7. In **Authentication → Providers → Google**, enable Google and configure the OAuth client ID/secret and callback URL shown by Supabase.
8. In **Authentication → Providers → Email**, keep email confirmation enabled for a public launch.

The auth trigger creates a profile, personal workspace, owner membership and free subscription for each new account. Guest users can register for public/unlisted events without an account. Guests cannot create or manage draws.

## 2. Local development

```bash
npm install
cp .env.example .env.local
```

Set `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_APP_URL=http://localhost:5173/
```

Start the development server:

```bash
npm run dev
```

Validate before pushing:

```bash
npm run typecheck
npm run lint
npm run build
```

## 3. Deploy Supabase Edge Functions

Install the Supabase CLI, authenticate and link the project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy functions:

```bash
supabase functions deploy create-draw
supabase functions deploy execute-draw
supabase functions deploy verify-draw
supabase functions deploy register-event
supabase functions deploy join-room
```

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. The service-role key is used only server-side and must never be placed in `.env`, GitHub Actions variables exposed to Vite, or frontend source. The draw functions validate the caller's JWT and workspace role before privileged writes. Draw completion is committed through the `complete_draw_transaction` Postgres function so the status transition, winner rows, seed reveal and secret deletion are atomic.

`register-event`, `join-room` and `verify-draw` are configured as public functions in `supabase/config.toml`. They must have rate limiting/CAPTCHA and abuse controls added before a high-traffic public launch. `register-event` validates fields and uses a database unique index to reject duplicate event/email registrations.

## 4. GitHub Pages deployment

1. Create a GitHub repository named `domyx-draw` (or retain the dynamic base-path configuration).
2. Push the project to the `main` branch.
3. In repository **Settings → Pages**, select **GitHub Actions** as the source.
4. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (optional)
5. Push to `main` or manually run **Build and deploy to GitHub Pages**.

Vite derives the repository subpath from `GITHUB_REPOSITORY` during Actions builds. The Pages workflow copies `dist/index.html` to `dist/404.html` so browser-history routes can recover on refresh.

## 5. Grant administrator access

The first account is not automatically an administrator. After creating your account, use Supabase SQL Editor as the project owner to grant admin access to your verified Auth user ID:

```sql
update public.profiles
set is_admin = true
where id = 'YOUR_AUTH_USER_UUID';
```

Never expose a client-side control for `is_admin`. The profile update policy prevents a user from changing their own administrator flag. The admin route is only a UI guard; RLS and server-side authorization are the security boundary.

## 6. Implemented features

- Public landing page and responsive dark design.
- Email/password registration and login.
- Google OAuth sign-in (after provider setup).
- Authenticated dashboard with database-backed activity.
- Random draw creation using pasted names or CSV/text import.
- Comment Picker at `/dashboard/comment-picker` for Instagram, YouTube, Facebook, X, TikTok and other platforms using pasted comments or CSV, JSON and TXT imports. Includes post URL/profile attribution, comment review, include/exclude phrase rules, exact-match filtering, @mention and minimum-length filters, reply filtering when source data includes reply flags, per-account or per-comment weighting, multi-winner selection, rerolls and CSV export.
- Server-side cryptographic random source, weighted entries and no duplicate winners within one draw.
- Participant snapshot hash and seed commitment/reveal records.
- Draw result persistence and audit log records.
- Draw history with winner records and verification metadata.
- Independent verification of the seed commitment, participant snapshot hash and deterministic weighted winner selection.
- Public/unlisted event creation and shareable event links.
- Guest event registration through an Edge Function.
- Protected admin overview and platform counts.

## 7. Not yet implemented

- Chitty group/member/round/contribution management UI and allocation workflow.
- Live-room host UI, room creation and realtime viewer experience. Schema and guest join function are foundations only.
- Direct YouTube/Instagram/Facebook/X/TikTok comment fetching through official APIs. The Comment Picker currently supports pasted and CSV/TXT-imported comment data from any platform; automatic fetching requires a separate approved integration for each provider. Never collect comments by scraping private pages or bypassing platform restrictions.
- Premium checkout, billing webhooks and automatic entitlement lifecycle. Plan records are foundations only.
- Rate limiting, CAPTCHA/abuse prevention, storage policies, automated backups, monitoring and full security test coverage.

## Security and launch checklist

- [ ] Confirm all migrations run on a fresh Supabase project.
- [ ] Test RLS with two unrelated accounts and an anonymous session.
- [ ] Add CAPTCHA and rate limits to public registration and room joining.
- [ ] Add storage bucket policies before enabling uploads.
- [ ] Add server-side plan entitlement checks before enforcing premium limits.
- [ ] Add payment-provider webhook verification before accepting subscriptions.
- [ ] Add retry/recovery handling and tests around the transactional draw completion RPC.
- [ ] Version and test the draw algorithm and canonical participant snapshot format.
- [ ] Add independent verification test vectors and audit exports.
- [ ] Configure database backups, error monitoring and alerting.
- [ ] Review privacy policy, terms, data retention and applicable local laws before public launch.

## Important notes

- A Supabase anon/publishable key is designed to be public; RLS is mandatory.
- Never put a service-role key or OAuth client secret in the frontend.
- GitHub Pages serves static assets only. Privileged operations belong in Supabase Edge Functions or database functions.
- Chitty is a recordkeeping/group-management tool. It does not collect, hold, transfer or distribute money.
- No payment provider is configured by default.

## Chitty manager upgrade (November 2026)

The Chitty manager now supports separate member name and phone fields, monthly round scheduling, per-round contribution tracking, payment status updates, a server-audited monthly draw, payout history, and automatic exclusion of members who have already received a payout in the same group. Monthly draws require all active members' contributions for the current round to be marked paid. Winner selection uses the existing `create-draw` and `execute-draw` Edge Functions; the selected entry key is the member UUID, avoiding ambiguous matching when members share a name.

Before deploying this update, run `supabase/migrations/202611120001_chitty_allocation_permissions.sql` in the Supabase SQL Editor. Then deploy the updated `execute-draw` Edge Function and publish the frontend. The migration adds a transactional round-completion RPC and workspace-scoped allocation management; it does not disable RLS.

\n## Brand, SEO and social previews

The frontend brand is **Domyx ActivityDesk**. The root HTML includes SEO description, canonical URL, Open Graph metadata, Twitter/X large-image card metadata, a web app manifest and a social preview image at `public/og-image.png`.

Before publishing, confirm the canonical and preview URLs in `index.html` match the final public deployment URL. They currently target `https://ajas01862.github.io/domyx-draw/`. Social platforms cache previews; after deployment, use each platform's link-preview debugger to refresh its cached metadata.

## Comment Picker import format and API integrations

The Comment Picker accepts plain text (one comment per line), `username: comment` lines, tab-separated username/comment rows, CSV, and JSON arrays/objects. For reliable structured imports, use columns such as `username,comment,isReply,date,url`. It also accepts a post URL and creator/profile name as source attribution, but those fields do not fetch comments. The current version does not connect directly to social networks or store imported comments on the server. Use official platform exports or authorized data access.

Direct imports are provider-specific:
- YouTube: YouTube Data API access to video comments, subject to API quota and video/comment availability.
- Instagram and Facebook: Meta Graph API permissions and app review for eligible accounts/content.
- X: X API access and plan-dependent endpoints/limits.
- TikTok: approved TikTok developer products and scopes; public comment access is not generally available to every app.

Keep provider tokens on a trusted server (for example, Supabase Edge Functions) and never put private API secrets in Vite environment variables or browser code. Implement each connector separately with consent, rate limits, pagination, deletion handling and provider terms compliance.
