import Stripe from "stripe";

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;
