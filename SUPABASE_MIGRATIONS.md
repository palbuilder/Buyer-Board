# BuyerBoard Supabase Migrations

BuyerBoard now uses tracked Supabase migration files for executable schema changes.

## Source Of Truth

- `supabase/migrations/*.sql` is the executable schema history.
- `supabase/schema.sql` stays in the repo as the readable full-schema snapshot for code review and search.

When you change the database:

1. create a new migration
2. edit the migration SQL
3. mirror the final schema shape into `supabase/schema.sql`
4. push the migration with the CLI workflow below

This keeps the repo review-friendly without going back to manual SQL Editor pasting.

## One-Time Setup

Install project dependencies:

```powershell
cd "C:\Users\palcs\Documents\buyerboard"
& "C:\Program Files\nodejs\npm.cmd" install
```

Then pick one remote-apply path:

### Preferred for Codex and non-interactive scripts

Add `SUPABASE_DB_URL` to `.env.local`.

This lets package scripts push migrations without needing a separately linked CLI profile.

### Alternative linked-project path

If you prefer the normal Supabase linked-project flow, run:

```powershell
cd "C:\Users\palcs\Documents\buyerboard"
& "C:\Program Files\nodejs\npm.cmd" run db:link -- --project-ref YOUR_PROJECT_REF
```

## Common Commands

Check whether the repo is ready for CLI schema work:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:check
```

Create a new migration file:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:migration:new -- add_descriptive_name
```

Preview which migrations would be pushed:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:push:dry-run
```

Push migrations to the remote database:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:push
```

See local migration files versus remote migration history:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:migration:list
```

Reset a local Supabase CLI database if you are using the local container stack later:

```powershell
& "C:\Program Files\nodejs\npm.cmd" run db:reset:local
```

## Current offers_status_check issue

The current baseline migration already includes the `offers_status_check` refresh with:

- `pending`
- `accepted`
- `declined`
- `countered`
- `withdrawn`

That means this constraint fix is now part of the tracked CLI migration workflow instead of being a one-off SQL Editor patch.
