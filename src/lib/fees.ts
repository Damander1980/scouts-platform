// Stripe card processing is 2.9% + 30 cents. By default online payers cover it so the unit receives the
// full amount (a unit can choose to absorb it); paying a leader in person (cash or check) has no fee. Rate comes from one place so it
// is easy to update if Stripe's pricing changes.
export const CARD_RATE = 0.029;
export const CARD_FIXED_CENTS = 30;

// Fee to add on top of `cents` so that after Stripe takes its cut the unit still gets `cents`.
export function coverFee(cents: number) {
  return Math.ceil((cents + CARD_FIXED_CENTS) / (1 - CARD_RATE)) - cents;
}

// Each unit chooses which ways families can pay and who covers the card fee (unit settings).
export type PaymentPrefs = { methods: "both" | "card" | "cash"; feePayer: "family" | "unit" };

export function paymentPrefs(settings: Record<string, unknown> | null | undefined): PaymentPrefs {
  const m = settings?.payment_methods;
  return {
    methods: m === "card" || m === "cash" ? m : "both",
    feePayer: settings?.card_fee_payer === "unit" ? "unit" : "family",
  };
}

// Card fee the family pays on top of `cents` (zero when the unit absorbs it).
export function familyFee(cents: number, prefs: PaymentPrefs) {
  return prefs.feePayer === "unit" || cents <= 0 ? 0 : coverFee(cents);
}
