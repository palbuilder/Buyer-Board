# BuyerBoard

BuyerBoard is a demand-first marketplace prototype.

Instead of sellers posting items and hoping buyers find them, buyers post what they want to buy. Sellers then browse those requests, send claim offers, negotiate, and fulfill the request if the buyer approves.

## Run The Site

From PowerShell:

```powershell
cd "C:\Users\palcs\Documents\buyerboard"
& "C:\Program Files\nodejs\npm.cmd" run dev
```

Then open:

[http://localhost:3000](http://localhost:3000)

## Important Project Folders

- `app/`
  Main pages, layouts, forms, and API routes
- `lib/`
  Shared business logic, data loaders, auth helpers, messaging logic, and notifications
- `supabase/schema.sql`
  Database tables, constraints, storage setup, and helper database functions
- `BUILD_ROADMAP.md`
  Product build phases and future direction
- `TRUST_SAFETY_PLAN.md`
  Trust and moderation direction
- `PAYMENTS_MONETIZATION_PLAN.md`
  Payments and monetization direction
- `API_REFERENCE.md`
  Plain-English API map for future app and integration work

## Checks

Run:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run lint
& "C:\Program Files\nodejs\npm.cmd" run build
```

## Schema Workflow

BuyerBoard now uses tracked Supabase migrations instead of manual SQL Editor pasting as the normal path.

Common commands:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:check
& "C:\Program Files\nodejs\npm.cmd" run db:push:dry-run
& "C:\Program Files\nodejs\npm.cmd" run db:push
```

- `supabase/migrations/*.sql`
  Executable schema history
- `supabase/schema.sql`
  Readable full-schema snapshot

See [SUPABASE_MIGRATIONS.md](/C:/Users/palcs/Documents/buyerboard/SUPABASE_MIGRATIONS.md) for the full migration workflow.

## Online Deployment

If you want to move BuyerBoard online instead of running only on your computer, use:

- [DEPLOY_VERCEL.md](/C:/Users/palcs/Documents/buyerboard/DEPLOY_VERCEL.md)
- [VERCEL_ENV_TEMPLATE.txt](/C:/Users/palcs/Documents/buyerboard/VERCEL_ENV_TEMPLATE.txt)

## Current Architecture Direction

BuyerBoard now has two layers:

- page/server-action flows for the web app
- API routes for mobile-readiness and future app use

That means the website can keep moving fast now, while the core actions are becoming reusable for a future mobile app.
