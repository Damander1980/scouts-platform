import { describe, expect, it } from "vitest";
import { CARD_FIXED_CENTS, CARD_RATE, coverFee, familyFee, paymentPrefs } from "../fees";

describe("coverFee", () => {
  it("leaves the unit the full amount after Stripe's cut", () => {
    for (const cents of [100, 4500, 12500, 99999]) {
      const total = cents + coverFee(cents);
      const stripeTakes = Math.round(total * CARD_RATE) + CARD_FIXED_CENTS;
      expect(total - stripeTakes).toBeGreaterThanOrEqual(cents);
      expect(total - stripeTakes).toBeLessThanOrEqual(cents + 1);
    }
  });
});

describe("paymentPrefs", () => {
  it("defaults to both methods with families paying the fee", () => {
    expect(paymentPrefs(undefined)).toEqual({ methods: "both", feePayer: "family" });
    expect(paymentPrefs({ payment_methods: "nonsense" })).toEqual({ methods: "both", feePayer: "family" });
  });
  it("reads the unit's choices", () => {
    expect(paymentPrefs({ payment_methods: "cash", card_fee_payer: "unit" })).toEqual({ methods: "cash", feePayer: "unit" });
  });
});

describe("familyFee", () => {
  it("is zero when the unit absorbs the fee or nothing is owed", () => {
    expect(familyFee(4500, { methods: "both", feePayer: "unit" })).toBe(0);
    expect(familyFee(0, { methods: "both", feePayer: "family" })).toBe(0);
  });
  it("matches coverFee when families pay", () => {
    expect(familyFee(4500, { methods: "card", feePayer: "family" })).toBe(coverFee(4500));
  });
});
