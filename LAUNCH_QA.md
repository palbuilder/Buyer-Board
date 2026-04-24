# BuyerBoard Launch QA

This is the practical local browser and verification checklist for BuyerBoard's current launch-readiness pass.

## Required Setup

1. Work from `C:\Users\palcs\Documents\buyerboard`.
2. Apply the current tracked migrations before QA:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:push
```

`[supabase/schema.sql](/C:/Users/palcs/Documents/buyerboard/supabase/schema.sql)` stays as the readable snapshot, but tracked migrations are now the executable path.
3. Fill in `.env.local` with the local values you need.
4. Run the local readiness check:

```powershell
cd "C:\Users\palcs\Documents\buyerboard"
& "C:\Program Files\nodejs\npm.cmd" run qa:readiness
```

5. Optional before starting the app: enable localhost-only captcha bypass for manual QA.

```powershell
$env:BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS="true"
```

6. Start the app:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run dev
```

7. If you want seeded browser accounts, run:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run seed:dev
```

## Environment Prerequisites

### Needed for local browser QA

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BUYERBOARD_APP_URL`

### Needed for non-interactive schema pushes

- `SUPABASE_DB_URL`, or a one-time linked project via `npm run db:link -- --project-ref YOUR_PROJECT_REF`

### Needed for seeded local QA

- `SUPABASE_SERVICE_ROLE_KEY`
- `BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS=true` only if you want localhost-only captcha bypass during manual QA

### Needed for internal job route testing

- `BUYERBOARD_INTERNAL_CRON_SECRET`

## Seeded Users And What To Test

### Alex Mercer

- Role: buyer
- Use for:
  - request board and request detail rendering
  - notification bell, single read, bulk read, single delete, bulk delete
  - seeded direct thread with Morgan Reed

Expected seeded state:

- owns the Milwaukee request
- owns the Bosch router request
- has an unread notification
- seeded requests are fresh enough to appear in the default seller opportunity feed window

### Taylor Nguyen

- Role: buyer
- Use for:
  - negotiating request state
  - report follow-up and stale-request confirmation UI checks

Expected seeded state:

- owns the Subaru headlight request
- owns the seeded unsafe-listing report

### Morgan Reed

- Role: seller
- Use for:
  - business-name seller payout onboarding copy/path
  - direct-message existing-thread behavior
  - offer visibility against Alex's requests

### Jamie Cruz

- Role: seller
- Use for:
  - individual-seller payout onboarding copy/path
  - counteroffer visibility against Taylor's request

### Riley Chen

- Role: admin
- Use for:
  - `/admin/reports`
  - dashboard admin shortcuts
  - report resolution workflow discovery

## Automated Verification

Run these before or after the manual session:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run qa:readiness
& "C:\Program Files\nodejs\npm.cmd" run qa:regression
& "C:\Program Files\nodejs\npm.cmd" run qa:smoke
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build
```

### What `qa:smoke` covers now

- public request and highlights APIs
- auth-first protection on changed write APIs
- changed messaging API guard paths
- changed notifications API guard paths, including single and bulk read/delete endpoints used by the bell tray
- admin resolution API guard paths
- internal digest and stale-request routes returning either:
  - `401 Unauthorized` when cron auth is configured and missing
  - a clear `BUYERBOARD_INTERNAL_CRON_SECRET` configuration error when it is not set yet

## Manual Browser Checklist

### Buyer checklist

Sign in as Alex Mercer.

- Open `/requests`
- Confirm seeded requests render without duplicate tag warnings or broken layout
- Open Alex's request detail pages
- Confirm location shows only public city/state style data
- Open the top-right bell tray without leaving the current page
- Mark one notification read from the tray
- Mark multiple notifications read from the tray
- Delete one notification from the tray
- Delete multiple notifications from the tray
- Start or reopen a seller conversation only from the request detail context
- Open `/messages`
- Confirm the seeded thread with Morgan Reed opens correctly

Expected outcomes:

- request cards and detail pages render cleanly
- no public street-address detail is exposed on requests
- new buyer-to-seller message threads can start from the request context
- notification bell unread count changes after cleanup actions
- notification cleanup actions succeed without redirect loops or page navigation

### Seller checklist

Sign in as Morgan Reed, then Jamie Cruz in a separate browser session.

- Open `/dashboard?tab=seller`
- For Morgan, confirm payout setup copy still fits a business-name seller
- For Jamie, confirm payout setup copy still fits an individual seller
- Open `/messages` as Jamie and confirm there is no arbitrary member-search starter for regular users
- Open a request context where the seller already has marketplace involvement
- Confirm any new seller-side conversation start happens only from valid marketplace context
- Open `/messages`
- Confirm Morgan's existing inbox thread with Alex still opens normally

Expected outcomes:

- seller payout wording does not force casual sellers into business-only language
- regular sellers cannot start brand-new arbitrary direct outreach from the inbox or seller-profile shortcuts
- existing valid marketplace threads still open correctly

### Admin checklist

Sign in as Riley Chen.

- Open `/dashboard`
- Use the admin shortcuts card
- Open `/messages`
- Use the admin outreach search to find a member and open a thread
- Open `/admin/reports`
- Confirm the seeded unsafe-listing report is visible
- Start the existing admin report resolution flow from there

Expected outcomes:

- it is obvious where unsafe request reports are handled
- the report queue is easy to find from dashboard and reports page copy
- admins can still initiate direct outreach when needed

### Internal stale-request workflow

This is easiest after `BUYERBOARD_INTERNAL_CRON_SECRET` is set.

- Call `POST /api/internal/requests/stale/run?force=true` with the configured cron secret when testing against the fresh dev seed
- Use separately aged requests if you want to observe the non-forced production timing

Expected outcomes:

- active stale requests receive reminder notifications
- after two missed confirmations, the request is archived

## External Services Still Deferred

These are intentionally not fully finished in this local pass:

- public domain or staging URL
- full Stripe Connect live rollout on a public site
- Twilio production setup
- real email sender rollout

## Still Needs Staging Or Public Verification Later

- full Stripe return flows on a public URL
- Twilio delivery and sync with real devices
- real outbound email delivery
- internal cron jobs behind real scheduler auth
- any public-facing link behavior that depends on non-local URLs
