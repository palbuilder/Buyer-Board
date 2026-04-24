# BuyerBoard Payments And Monetization

## Core principle

The marketplace should always keep a free path for normal users:

- Buyers can post requests for free.
- Sellers can respond for free.
- The platform earns money primarily when a transaction closes.

That keeps the marketplace liquid early and avoids charging users before value is delivered.

## Recommended payment model

Use a marketplace payment provider that supports platform fees and seller onboarding.

Recommended choice:

- Stripe Connect for seller onboarding and payout routing

Why:

- It fits marketplace payouts well.
- It supports platform/application fees.
- It scales from individuals to businesses.

## Fee structure recommendation

### Free individual accounts

- Buyers: free to post requests
- Sellers: free to browse and send claim offers
- Platform fee: 8% to 10% on completed transactions

### Premium buyer plan

Target user:

- frequent buyers
- repair shops
- parts hunters
- collectors

Suggested benefits:

- saved searches and request alerts
- priority placement for requests
- lower service fee on completed transactions
- request templates and faster reposting
- higher-value posting limits before extra verification

Suggested pricing:

- monthly subscription later, after core usage is proven

### Business seller plan

Target user:

- thrift stores
- pawn shops
- used parts shops
- budget auto repair shops
- liquidation and resale businesses

Suggested benefits:

- lower transaction fee than free sellers
- business badge on profile
- bulk response tools later
- faster payout timing later
- business analytics dashboard

Suggested pricing:

- monthly subscription plus reduced transaction fee

## Suggested launch tiers

### Tier 1: MVP launch

- Free buyer accounts
- Free seller accounts
- Platform fee on completed transactions
- Manual business onboarding later

### Tier 2: Early monetization

- Premium buyers
- Business sellers
- Lower fee incentives for trusted repeat users

### Tier 3: Mature marketplace

- automated business onboarding
- tiered seller fees by volume
- promotions / featured requests
- optional advertising products for business sellers

## Anti-abuse and trust recommendations

### Day one

- email sign-in link
- CAPTCHA on auth flows
- Supabase auth rate limits
- verified session required to post or send claim offers

### Next trust layer

- phone verification required for:
  - sending seller claim offers above a value threshold
  - repeated posting / offer activity
  - business seller upgrade
  - payout-enabled sellers

### Later

- suspicious activity flags
- account review queue
- business verification
- payout holds for risky accounts

## Payment workflow recommendation

1. Buyer accepts a claim offer.
2. Buyer pays through the platform.
3. Platform records payment and fee.
4. Seller ships inside the approved claim window.
5. Seller payout is released after shipment / completion rules.

This is safer than letting payment happen off-platform because it preserves monetization and gives the marketplace enforcement leverage.

## Product note

For the MVP, build in this order:

1. Authentication
2. User profiles
3. Payment account fields and transaction records
4. Stripe Connect seller onboarding
5. Buyer checkout and platform fee capture
6. Phone verification gates for risky actions
