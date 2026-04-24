# BuyerBoard Build Roadmap

## Where We Are

The project now has:

- a working Next.js app
- a landing page
- a request board
- a buyer request form
- a request detail page
- mock request and offer data
- a first-pass Supabase/Postgres schema

## What We Build Next

### Phase 1: Real Data

Goal:
Replace mock data with a real database.

Tasks:

1. Create a Supabase project
2. Run the schema in `supabase/schema.sql`
3. Add environment variables for Supabase URL and anon key
4. Add server-side data fetching for requests
5. Replace `lib/mock-data.ts` usage with database queries

### Phase 2: Authentication

Goal:
Let buyers and sellers create accounts and interact with real records.

Tasks:

1. Add Supabase auth
2. Create buyer and seller profile records
3. Gate request creation behind login
4. Gate offer creation behind login

### Phase 3: Core Marketplace Actions

Goal:
Make the marketplace actually usable.

Tasks:

1. Save new buyer requests to the database
2. Let sellers submit offers
3. Show offers on each request detail page
4. Let buyer accept an offer
5. Update request status automatically

### Phase 4: Claim Window

Goal:
Support your hold-period idea.

Tasks:

1. Add a seller claim action
2. Record claim expiration timestamps
3. Show claim timers in the UI
4. Reopen requests when a claim expires

### Phase 5: Messaging And Fees

Goal:
Track negotiation and prepare for monetization.

Tasks:

1. Add request-level messaging
2. Save final agreed price
3. Record platform fee amount
4. Add a simple admin review page

### Phase 6: Mobile Readiness

Goal:
Keep the web product easy to turn into a future mobile app without rebuilding the core logic.

Tasks:

1. Move important marketplace actions behind clean server-side endpoints or reusable data functions
2. Keep auth/session flows compatible with future mobile token-based sign-in
3. Avoid page-only business logic when the same action may later be needed in iPhone/Android apps
4. Keep uploads, notifications, and messaging models shared and app-friendly
5. Audit navigation and key user flows for mobile-sized screens first
6. Prefer portable response shapes for claims, offers, notifications, and profile data

## Recommended Immediate Next Step

The next best move is:

1. Create a Supabase project
2. Connect this app to it
3. Replace the mock request board with live requests

That is the first moment this stops being a concept demo and becomes a real product.
