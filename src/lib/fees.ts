// Stripe card processing is 2.9% + 30 cents. Online payers always cover it so the unit receives the
// full amount; paying a leader in person (cash or check) has no fee. Rate comes from one place so it
// is easy to update if Stripe's pricing changes.
export const CARD_RATE = 0.029;
export const CARD_FIXED_CENTS = 30;

// Fee to add on top of `cents` so that after Stripe takes its cut the unit still gets `cents`.
export function coverFee(cents: number) {
  return Math.ceil((cents + CARD_FIXED_CENTS) / (1 - CARD_RATE)) - cents;
}
