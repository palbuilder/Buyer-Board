# BuyerBoard API Reference

This file is a simple map of the app-ready endpoints that now exist in BuyerBoard.

These routes are useful for:

- a future mobile app
- internal integrations
- moving more of the website onto reusable API calls later

## Notes

- Most routes require the user to already be signed in.
- Protected write routes now fail auth-first, so app and mobile callers get a clean `401` JSON response before field-level validation.
- Most routes return JSON.
- Errors return a JSON object with an `error` message.
- Write routes are treated as JSON-first app endpoints, not page-only helpers.
- The current error contract is intentionally simple for future app use:
  - success: route-specific JSON payload
  - failure: `{ "error": "Human readable message" }`
- BuyerBoard now applies lightweight app-layer rate limiting on the busiest write paths.
  - This is a best-effort anti-spam guard for duplicate clicks and burst abuse.
  - It does not replace the stronger protections we still expect from auth, CAPTCHA, and future edge-level controls.
- These routes currently use the same auth/session rules as the website.

## Marketplace Requests

### `GET /api/requests`

Returns the current request board.

Use it for:

- loading the main board
- future mobile browse screens

### `POST /api/requests`

Creates a new buyer request.

Important fields:

- `title`
- `category`
- `subcategory`
- `targetBudget`
- `conditionPreference`
- `location`
- `shippingPreference`
- `description`
- `imageUrls`
- `vehicleYear`
- `vehicleMake`
- `vehicleModel`

## Single Request

### `GET /api/requests/[requestId]`

Returns one request plus its seller offers.

Use it for:

- request detail screens
- mobile compare-offers screens

## Market Intelligence

### `GET /api/home/highlights`

Returns home-page highlight data.

Use it for:

- homepage widgets
- future marketplace summary cards
- external read-only dashboards

### `GET /api/market/daily-summary`

Returns a filtered request digest that is useful for newsletters, daily seller roundups, or industry-specific request pulls.

Query params:

- `category`
- `subcategory`
- `state`
- `sinceHours`

Use it for:

- daily new-request emails
- category-specific newsletters
- state-specific part-pull lists

### `GET /api/market/opportunities`

Returns a seller-focused opportunity feed with summary metrics and matching requests.

Query params:

- `category`
- `subcategory`
- `state`
- `sinceHours`
- `minBudget`

Use it for:

- power-seller dashboards
- business seller intelligence
- junkyard / picker / reseller daily planning

### `GET /api/market/opportunities/export`

Returns the same seller opportunity feed as a CSV download.

Query params:

- `category`
- `subcategory`
- `state`
- `sinceHours`
- `minBudget`

Use it for:

- spreadsheet workflows
- daily pull sheets
- print/export use outside the site

## Seller Offers

### `POST /api/requests/[requestId]/offers`

Creates a seller offer on a request.

Important fields:

- `offeredPrice`
- `message`
- `proposedClaimWindowHours`
- `imageUrls`

## Buyer Claim Decisions

### `POST /api/requests/[requestId]/claim-decision`

Lets the buyer accept, decline, or counter a seller offer.

Important fields:

- `offerId`
- `decision`
  Allowed:
  - `accepted`
  - `declined`
  - `countered`
- `buyerComment`

## Profile

### `GET /api/me/profile`

Returns the signed-in member profile.

### `PATCH /api/me/profile`

Updates the signed-in member profile.

Important fields:

- `displayName`
- `publicLocation`
- `shippingName`
- `shippingAddressLine1`
- `shippingAddressLine2`
- `shippingCity`
- `shippingState`
- `shippingPostalCode`
- `accountType`
- `planTier`
- `businessName`
- `phoneNumber`

## Seller Profiles

### `GET /api/sellers/[sellerId]`

Returns the public seller profile snapshot.

Use it for:

- mobile seller profile screens
- offer trust popups
- future public reputation widgets

## Notifications

### `GET /api/notifications`

Returns the current user’s notifications.

### `GET /api/notifications/preferences`

Returns the current user’s notification preferences.

### `PUT /api/notifications/preferences`

Updates the current user’s notification preferences.

Fields:

- `watchlist`
- `offersClaims`
- `disputes`
- `trustSafety`
- `moderation`
- `emailOptIn`

### `PATCH /api/notifications/[notificationId]`

Marks one notification as read.

### `POST /api/notifications/read-all`

Marks all notifications as read.

## Direct Messages

### `GET /api/messages/threads`

Returns the current user’s inbox threads.

### `POST /api/messages/threads`

Starts or reuses a private thread with another member.

Field:

- `memberId`

### `GET /api/messages/threads/[threadId]`

Returns messages for one private thread.

### `POST /api/messages/threads/[threadId]/messages`

Sends a private message in a thread.

Field:

- `body`

This route can also return a moderation notice if the message is held for review.

## Relationships

### `GET /api/relationships/[memberId]`

Returns the current relationship state with that member.

Response includes:

- `isFollowing`
- `isBlocked`

### `POST /api/relationships/[memberId]`

Updates the relationship with that member.

Field:

- `action`
  Allowed:
  - `follow`
  - `unfollow`
  - `block`
  - `unblock`

## Claims

### `POST /api/claims/[claimId]/complete`

Lets the seller holding a claim mark it complete.

Field:

- `requestId`

## Reports

### `POST /api/reports`

Creates a listing or seller-offer report.

Fields:

- `requestId`
- `offerId`
- `reportTarget`
  Allowed:
  - `request`
  - `offer`
- `reason`
- `details`
- `imageUrls`

## Disputes

### `POST /api/disputes`

Creates a buyer dispute on a completed transaction.

Fields:

- `transactionId`
- `requestId`
- `reason`
- `details`
- `buyerEvidence`
- `buyerEvidenceImageUrls`

### `POST /api/disputes/[disputeId]/seller-response`

Lets the seller respond to a dispute.

Fields:

- `response`
- `sellerEvidence`
- `sellerEvidenceImageUrls`

## Reviews

### `POST /api/reviews`

Creates a buyer review after a completed order.

Fields:

- `transactionId`
- `requestId`
- `rating`
- `reviewText`

## Phone Verification Sync

### `POST /api/phone/verification/sync`

Syncs a verified phone from Supabase Auth into the BuyerBoard profile.

Use it after SMS verification succeeds.

## Admin Routes

These require admin access.

### `POST /api/admin/reports/[reportId]/resolution`

Resolves a listing report.

Fields:

- `requestId`
- `offerId`
- `resolution`
- `adminNote`

### `POST /api/admin/disputes/[disputeId]/resolution`

Resolves a dispute.

Fields:

- `resolution`
- `resolutionNote`

## Integration Webhooks

### `GET /api/integrations/webhooks`

Returns the signed-in member's saved webhook subscriptions.

### `POST /api/integrations/webhooks`

Creates a webhook subscription.

Fields:

- `endpointUrl`
- `eventTypes`

Supported event types right now:

- `request.created`
- `offer.created`
- `claim.accepted`
- `transaction.funded`
- `dispute.created`

### `PATCH /api/integrations/webhooks/[subscriptionId]`

Updates an existing webhook subscription.

Fields:

- `endpointUrl`
- `eventTypes`
- `isActive`

### `DELETE /api/integrations/webhooks/[subscriptionId]`

Deletes an existing webhook subscription.

## Internal Jobs

These are meant for future scheduler/cron use, not normal users.

### `POST /api/internal/digests/run`

Processes due seller digest deliveries.

Auth:

- `Authorization: Bearer <BUYERBOARD_INTERNAL_CRON_SECRET>`
  or
- `x-buyerboard-cron-secret: <BUYERBOARD_INTERNAL_CRON_SECRET>`

Optional query params:

- `force=true`
- `profileId`

Use it for:

- future scheduled seller digest sends
- internal delivery testing
- one-off digest backfills

## Mobile App Readiness

BuyerBoard is now partway prepared for a future mobile app because:

- request browsing has API routes
- request detail and seller offers have API routes
- claim decisions have API routes
- home highlights have an API route
- buyer and seller dashboard summaries have API routes
- profile reads and updates have API routes
- notifications have API routes
- direct messaging has API routes
- reports, disputes, reviews, and relationship actions have API routes
- public seller profiles have an API route
- newsletter / intelligence feeds have API routes
- webhook subscriptions now have API routes

## Launch QA Smoke Check

Run `npm run qa:smoke` while the local dev server is running to verify the current API auth and read-route smoke checks.
