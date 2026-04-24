# BuyerBoard Dev Seed

BuyerBoard includes a deterministic local seed path so browser QA can be run with the same buyer, seller, and admin accounts every time.

## Before You Start

1. Apply the current tracked migrations with `npm run db:push`.
   - [supabase/schema.sql](/C:/Users/palcs/Documents/buyerboard/supabase/schema.sql) stays as the readable snapshot, but migrations are now the executable schema path.
2. Add the required local environment values to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `BUYERBOARD_APP_URL`
3. Add `SUPABASE_SERVICE_ROLE_KEY` if you want the seed script to actually create the users and print magic links.
4. Add `SUPABASE_DB_URL` if you want non-interactive migration pushes from local scripts or Codex.
5. Run `npm run db:check` if you want a quick schema-workflow check before pushing or seeding.
6. Run `npm run qa:readiness` if you want a quick app/setup check before seeding.
7. Optional: add `BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS=true` if you want localhost-only sign-in without solving CAPTCHA during local QA. This bypass still requires `SUPABASE_SERVICE_ROLE_KEY` and never turns on in production mode.

## Commands

Preview the seed plan without changing data:

```bash
node scripts/dev-seed.mjs
```

Important: preview mode does not write anything. If you expected other-user requests to appear on the board or seller feed, preview mode alone will not do that.

Apply the deterministic seed:

```bash
npm run seed:dev
```

## Seeded Users

### Alex Mercer

- Role: buyer
- Email: `alex.buyer.dev@buyerboard.local`
- Owns:
  - `dev-seed-milwaukee-m18-impact-kit`
  - `dev-seed-bosch-router-combo-kit`
- Also has:
  - a direct-message thread with Morgan Reed
  - an unread notification for bell/read/delete testing

### Taylor Nguyen

- Role: buyer
- Email: `taylor.collector.dev@buyerboard.local`
- Owns:
  - `dev-seed-2019-subaru-outback-headlight`
- Also has:
  - the seeded unsafe-listing report that should appear in the admin reports queue

### Morgan Reed

- Role: seller
- Email: `morgan.parts.dev@buyerboard.local`
- Profile shape:
  - business-name seller (`Northside Parts`)
- Owns:
  - an offer on Alex's Milwaukee request
  - an offer on Alex's Bosch router request
- Also has:
  - the seeded direct-message thread with Alex

### Jamie Cruz

- Role: seller
- Email: `jamie.tools.dev@buyerboard.local`
- Profile shape:
  - individual seller with no business name
- Owns:
  - the seeded counteroffer on Taylor's Subaru headlight request

### Riley Chen

- Role: admin
- Email: `riley.admin.dev@buyerboard.local`
- Use for:
  - `/admin/reports`
  - admin queue shortcuts from the dashboard
  - moderation resolution-path checks

## What Gets Created

- 5 repeatable users
- 3 repeatable requests stamped within the last 24 hours so the seller opportunity feed shows them immediately
- 3 repeatable offers
- 1 direct-message thread with 2 messages
- 2 sample notifications
- 1 open unsafe-listing report

## How Local Sign-In Works

After a successful `npm run seed:dev` run, the script prints fresh local magic links for every seeded account.

Use them like this:

1. Start the app locally with `npm run dev`.
2. Run `npm run seed:dev`.
3. Copy the printed magic link for the user you want.
4. Open that link in the browser profile/window you want to use for that user.
5. BuyerBoard will sign that browser into the matching seeded account.

Tip: use separate browser profiles or an incognito window so buyer, seller, and admin sessions do not overwrite each other.

If you enable `BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS=true` and have `SUPABASE_SERVICE_ROLE_KEY` locally, the `/auth` page can generate the magic-link sign-in directly on localhost without showing CAPTCHA.

## Safe Reruns And Reset Scope

The seed rerun cleanup is intentionally narrow. It only removes:

- the fixed seed request slugs
- direct threads between the fixed seed users
- notifications owned by the fixed seed users

It does not wipe unrelated local data.

## Best QA Pairings

- Buyer request and notification testing: Alex Mercer
- Negotiating request and report follow-up testing: Taylor Nguyen
- Business-style seller payout testing: Morgan Reed
- Individual seller payout testing: Jamie Cruz
- Admin moderation testing: Riley Chen

## Stale-Request Testing Note

The seed data is intentionally fresh so sellers can see it right away in the default 24-hour feed. For stale-request testing, either:

- call `/api/internal/requests/stale/run?force=true` with the internal cron secret, or
- prepare separate older request data on purpose
