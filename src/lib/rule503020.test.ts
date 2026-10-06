import { describe, it, expect } from "vitest";
import { compute503020 } from "./rule503020";

describe("compute503020", () => {
  it("calcola target e sforamenti", () => {
    const r = compute503020(200000, { NEEDS: 120000, WANTS: 50000, SAVINGS: 20000 });
    expect(r[0].target).toBe(100000);
    expect(r[0].over).toBe(true);
    expect(r[1].over).toBe(false);
    expect(r[2].target).toBe(40000);
    expect(r[2].over).toBe(true); // risparmiato meno del 20%
  });
  it("reddito zero non divide per zero", () => {
    const r = compute503020(0, { NEEDS: 0, WANTS: 0, SAVINGS: 0 });
    expect(r[0].actualPct).toBe(0);
  });
});
