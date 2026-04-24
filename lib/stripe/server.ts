import Stripe from "stripe";
import { getStripeEnv, hasStripeEnv } from "@/lib/stripe/config";

let stripeClient: Stripe | null = null;

export function createStripeServerClient() {
  if (!hasStripeEnv()) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(getStripeEnv().secretKey!);
  }

  return stripeClient;
}
