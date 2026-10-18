import Stripe from "stripe";

export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

export const paymentsEnabled = () => !!process.env.STRIPE_SECRET_KEY;

// Card processing estimate shown to families who choose to cover fees (2.9% + 30¢).
export function coverFee(cents: number) {
  return Math.ceil((cents + 30) / (1 - 0.029)) - cents;
}
