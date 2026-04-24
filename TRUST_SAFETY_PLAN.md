# BuyerBoard Trust And Safety

## Core scam risks we need to design around

### Wrong item sent

Example:

- Buyer requests a `1990 Ford Ranger alternator`
- Seller sends an alternator for a different year or a different vehicle entirely

### Item arrives but does not work

Example:

- Correct part number was promised
- Buyer installs it
- Part is dead on arrival or fails immediately

### Item not as described

Examples:

- Seller claims tested and working but it was not tested
- Seller hides damage
- Seller leaves out a critical included piece

## Product protections to build

### 1. Verified accounts for risky actions

- email sign-in required
- CAPTCHA on auth
- phone verification before:
  - high-value claim offers
  - seller payout onboarding
  - business account upgrades

### 2. On-platform payment

- buyer pays through platform
- platform keeps fee capture on-platform
- payouts can be delayed if an issue is reported

### 3. Seller claim windows

- buyer approves claim window before seller gets the order
- seller performance tracks on-time fulfillment

### 4. Buyer dispute reporting

Dispute reasons should explicitly include:

- wrong item
- defective item
- not as described
- shipping issue
- other

### 5. Review window after delivery

Recommended future rule:

- buyer has a limited review period after delivery to report a problem
- if no issue is reported, payout releases automatically

## Recommended resolution workflow

1. Buyer reports issue.
2. Platform marks dispute as open.
3. Seller responds with explanation, replacement, or refund offer.
4. Platform decides whether dispute is resolved for buyer or seller.
5. Repeated wrong-item or defective-item reports reduce seller trust.

## Trust signals to show publicly later

- seller rating
- shipped within claim window percentage
- phone verified badge
- business badge
- dispute rate over time

## Important product principle

For used parts and thrift-style items, protection against `wrong item` and `defective item` matters more than polished marketplace design. If the dispute path feels weak, users will not trust the platform with payments.
