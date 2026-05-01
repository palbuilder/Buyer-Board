# BuyerBoard Online Deployment Guide

This guide moves BuyerBoard from "only on your computer" to "running on the internet."

## What Vercel Is

Vercel is a hosting service.

Plain-English version:

- GitHub stores your code.
- Vercel takes that code and puts the website online.
- Supabase stays in charge of the database and sign-in.

For BuyerBoard, that means:

- Vercel hosts the Next.js website
- Supabase hosts the database and auth
- Stripe, Turnstile, and Resend stay connected through environment settings

## Before You Start

You should already have:

- the BuyerBoard repo in GitHub
- the current Supabase project
- the environment values from `.env.local`

If possible, keep this first online deployment as a preview or staging step, not a public launch.

## The Big Picture

You are going to do 6 things:

1. Create a Vercel account
2. Import the BuyerBoard GitHub repo into Vercel
3. Add BuyerBoard's environment variables in Vercel
4. Push the BuyerBoard database migrations to Supabase
5. Let Vercel build and publish the site
6. Test the online preview URL before worrying about a real public domain

## Step 1 - Create A Vercel Account

1. Go to [https://vercel.com](https://vercel.com)
2. Click **Sign Up**
3. Choose **Continue with GitHub**
4. Approve the connection if GitHub asks

You can think of this as: "let Vercel see my GitHub repos so it can build my site."

## Step 2 - Import BuyerBoard Into Vercel

1. After signing in, click **Add New...**
2. Click **Project**
3. Find the BuyerBoard GitHub repo
4. Click **Import**

You usually do **not** need to change the framework settings for this project.
BuyerBoard is already a Next.js app, and Vercel normally detects that automatically.

## Step 3 - Add The Environment Variables In Vercel

When Vercel asks for environment variables, copy them from your local `.env.local`.

Use [VERCEL_ENV_TEMPLATE.txt](/C:/Users/palcs/Documents/buyerboard/VERCEL_ENV_TEMPLATE.txt) as your checklist.

### Add these now

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  If you do not have this one, use `NEXT_PUBLIC_SUPABASE_ANON_KEY` instead.
- `SUPABASE_SERVICE_ROLE_KEY`
- `BUYERBOARD_APP_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

### Add these if you want those features working online now

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY`
- `BUYERBOARD_EMAIL_FROM`
- `BUYERBOARD_INTERNAL_CRON_SECRET`

### Very important

Do **not** turn on the local CAPTCHA bypass online.

In Vercel:

- either leave out `BUYERBOARD_ENABLE_LOCAL_CAPTCHA_BYPASS`
- or set it to `false`

Also set:

- `BUYERBOARD_APP_URL`

to your Vercel site URL once Vercel gives it to you.

At the very beginning, you can temporarily use the preview URL Vercel shows you.

## Step 4 - Push The Database Migrations

This step updates the real Supabase database so it matches the repo.

From PowerShell:

```powershell
cd "C:\Users\palcs\Documents\buyerboard"
& "C:\Program Files\nodejs\npm.cmd" run db:check
& "C:\Program Files\nodejs\npm.cmd" run db:push:dry-run
& "C:\Program Files\nodejs\npm.cmd" run db:push
```

If `db:push` says it cannot find a remote database target yet, add `SUPABASE_DB_URL` to `.env.local` first, then run it again.

This is the new replacement for pasting SQL manually into the Supabase dashboard.

## Step 5 - Deploy The Site

Once the environment variables are saved in Vercel:

1. Click **Deploy**
2. Wait for the build to finish
3. Open the URL Vercel gives you

That URL is your first online BuyerBoard version.

## Step 6 - Update URLs In Supabase And Turnstile

Once you have the Vercel URL:

### In Vercel

Make sure `BUYERBOARD_APP_URL` is set to that exact URL.

### In Supabase Auth

Add your Vercel URL to the redirect/allowed URL settings so sign-in redirects work online.

### In Cloudflare Turnstile

Make sure the allowed hostname includes your Vercel site hostname.

Without these updates, auth and CAPTCHA can look broken online even if the code is fine.

If the Turnstile box says **Unable to connect to website**, check the widget's Hostname Management settings in Cloudflare.
Add the hostname only, without `https://` and without any path.

Example:

```text
buyer-board.vercel.app
```

## First Online Test Session

After the first deployment, test in this order:

1. Open the homepage
2. Open the request board
3. Try signing in
4. Check request detail pages
5. Check the bell tray
6. Check messaging
7. Check admin reports

If you want seeded test users online, run the seed after the database migrations are applied.

## What Not To Treat As Finished Yet

These are still separate follow-up tasks:

- full public custom domain setup
- full live Stripe rollout
- full Twilio production setup
- real production email sending reputation/domain rollout
- real cron/scheduler setup for internal jobs

## If Something Fails

Use this simple rule:

- build failure in Vercel = usually missing or wrong environment variables
- sign-in failure = usually Vercel URL not added to Supabase allowed redirects
- CAPTCHA failure = usually wrong Turnstile keys or missing allowed hostname
- database mismatch = run `npm run db:push`

## Safe First Goal

Your first success target should be:

"BuyerBoard loads online on a Vercel preview URL, connects to Supabase correctly, and basic sign-in/request pages work."

That is the right next milestone before a full public launch.
