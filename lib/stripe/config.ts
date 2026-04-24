const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export function hasStripeEnv() {
  return Boolean(stripeSecretKey && stripePublishableKey);
}

export function getStripeEnv() {
  return {
    secretKey: stripeSecretKey,
    publishableKey: stripePublishableKey,
  };
}
