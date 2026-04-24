# Seller Intelligence And Integration Groundwork

BuyerBoard can grow into more than a simple website. A strong future revenue path is helping serious sellers turn live request data into a repeatable sourcing business.

## What exists now

- `GET /api/market/daily-summary`
  Good for newsletter-style digests and filtered daily request lists.
- `GET /api/market/opportunities`
  Good for more business-like seller dashboards and category planning.
- `GET /api/market/opportunities/export`
  Good for spreadsheet exports, pull sheets, and offline seller workflows.
- `GET /api/home/highlights`
  Good for public marketplace summaries.
- Saved seller digest subscriptions
  Good groundwork for future daily seller summaries inside the product, with user-friendly saved names and delivery-ready settings.
- Webhook subscription tables and API routes
  Good background groundwork for future internal, paid-tier, or B2B integrations.

## Easy future paid features

- Daily or hourly request digests by category
- State or metro request summaries
- Auto parts-only daily pull sheets
- “High budget requests only” feeds
- “Low competition / few offers so far” feeds
- Seller team dashboards for shops, junkyards, resellers, or parts runners

## Why this matters

A business seller might use BuyerBoard like this:

1. Pull a daily filtered request feed for `Auto Parts` in Georgia.
2. Sort by budget, shipping flexibility, and offer competition.
3. Visit a junkyard or inventory shelf with a live parts hit list.
4. Send offers back into BuyerBoard from those matched requests.

That is a real business workflow, not just a casual marketplace browse.

## Best next upgrades later

- Scheduled digest emails for saved filters
- CSV export for filtered request feeds
- Webhook delivery worker with signed payloads
- Business-seller analytics dashboard
- “Saved sourcing lists” for repeat categories and geographies

## Current delivery groundwork

- Sellers can save named digests with delivery toggled on or off.
- BuyerBoard now has an internal digest runner route:
  - `POST /api/internal/digests/run`
- That route is protected by an internal secret so it can later be called by a scheduler without exposing it to normal users.
- Once Resend is configured, the remaining step is simply choosing how often to trigger that route.
