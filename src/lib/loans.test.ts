import { describe, it, expect } from "vitest";
import { amortization, monthlyPayment } from "./loans";

describe("loans", () => {
  it("rata 100k a 3% su 20 anni ~ 554,60", () => {
    expect(Math.abs(monthlyPayment(10000000, 3, 240) - 55460)).toBeLessThan(5);
  });
  it("il piano si chiude a zero", () => {
    const rows = amortization(1000000, 5, 36);
    expect(rows).toHaveLength(36);
    expect(rows[35].balance).toBe(0);
  });
  it("tasso zero", () => {
    expect(monthlyPayment(120000, 0, 12)).toBe(10000);
  });
});
