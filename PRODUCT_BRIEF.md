# Reverse Marketplace MVP Brief

## Working Idea

Build a marketplace where buyers post items they want to purchase, including a description and target price, and sellers browse those requests to find opportunities to fulfill them.

Instead of listing products and hoping the right buyer sees them, this platform starts with buyer demand and lets sellers respond.

## Problem

Many people know what they want but do not have the time, patience, or product knowledge to hunt it down across multiple marketplaces.

At the same time, many sellers, resellers, collectors, and parts providers already have inventory or sourcing ability but do not know who is actively looking for a specific item right now.

## Core Value

- Buyers save time and surface hard-to-find needs.
- Sellers see real demand instead of guessing what to list.
- The platform earns a fee by matching intent to available supply.

## Target Users

### Buyers

- People searching for used goods, replacement parts, collectibles, tools, electronics, or niche items
- People who know what they want but cannot easily find it
- People who would rather post a request than search across many sites

### Sellers

- Individual resellers
- Small used-goods businesses
- Parts suppliers
- Hobbyists and collectors
- Anyone with inventory that matches posted demand

## MVP Goal

Validate that buyers will post requests and that sellers will respond fast enough to create completed transactions.

## MVP Buyer Flow

1. Buyer creates an account.
2. Buyer posts a wanted-item request.
3. Buyer includes title, description, condition preference, location/shipping preference, and target price.
4. Buyer sees seller responses or claim requests.
5. Buyer chooses a seller and messages them.
6. Request is marked fulfilled or closed.

## MVP Seller Flow

1. Seller creates an account.
2. Seller browses open buyer requests.
3. Seller opens a request and reviews details.
4. Seller responds with availability and terms, or claims the request if the platform supports claim-first workflow.
5. Seller and buyer finalize details in messaging.
6. Seller ships or delivers the item.
7. Transaction is marked complete.

## MVP Features

- User accounts for buyers and sellers
- Create, edit, and close wanted-item posts
- Request fields:
  - item title
  - category
  - description
  - target price
  - condition
  - photos or reference images optional
  - location
  - shipping or local pickup preference
  - request status
- Public request feed for sellers
- Search and filter requests
- Seller response or claim action
- Basic direct messaging between buyer and seller
- Admin ability to review users, requests, and reported issues
- Platform fee setting recorded for completed transactions

## Features To Delay Until After MVP

- In-app payments
- Escrow
- Automatic shipping labels
- Ratings and reviews
- Dispute handling workflows
- Advanced hold periods and penalties
- Seller subscriptions
- Mobile apps
- AI-assisted matching

## Suggested MVP Marketplace Rules

- A buyer can have multiple open requests.
- A seller can respond to any open request.
- A request can move through statuses such as `open`, `in negotiation`, `claimed`, `fulfilled`, and `closed`.
- A claim should expire automatically if the seller does not confirm shipment within the hold period.
- The platform should record the final agreed sale price for fee calculation.

## Revenue Model

Primary model:

- Charge a percentage fee on completed transactions

Possible later models:

- Featured requests
- Seller subscription tools
- Priority matching
- Shipping add-ons

## Biggest Risks

### Trust and Safety

- Fake buyers posting unrealistic requests
- Fake sellers claiming requests they cannot fulfill
- Off-platform payment attempts
- Fraud, stolen goods, or counterfeit items

### Liquidity

- Not enough buyers in early days
- Not enough sellers responding quickly
- Thin categories with poor match rates

### Operations

- Disputes over item condition
- Shipping delays
- Cancellations after a claim

## MVP Success Metrics

- Number of buyer requests posted per week
- Percentage of requests receiving at least one seller response
- Time to first seller response
- Percentage of requests that become completed transactions
- Average transaction value
- Platform fee revenue

## Recommended Tech Direction For First Build

For a first Codex project, keep the stack simple:

- Frontend: Next.js
- Styling: Tailwind CSS
- Database: Supabase or PostgreSQL
- Auth: Supabase Auth or Clerk
- Hosting: Vercel

This gives us a fast path to a web MVP without overengineering.

## Best First Product Slice

If we want to start building immediately, the smallest useful version is:

1. Landing page
2. Sign up and login
3. Create wanted-item request form
4. Browse open requests page
5. Request detail page
6. Seller response button

That is enough to test whether the concept is interesting before building payments and fulfillment logic.

## Immediate Next Step

Scaffold a Next.js app and build:

- landing page
- request board
- create request form
- basic request detail page

## Assumptions Made

- We are starting with a web app, not a native mobile app.
- We are prioritizing speed to MVP over enterprise-grade workflows.
- We are validating market demand before building payment and dispute infrastructure.
