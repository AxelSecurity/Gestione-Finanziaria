import { describe, it, expect } from "vitest";
import { nextOccurrence } from "./recurrence";

describe("nextOccurrence", () => {
  it("clamp a fine mese ma torna al giorno ancora", () => {
    const feb = nextOccurrence(new Date(2025, 0, 31), "MONTHLY", 31);
    expect(feb.getDate()).toBe(28);
    expect(nextOccurrence(feb, "MONTHLY", 31).getDate()).toBe(31);
  });
  it("annuale e settimanale", () => {
    expect(nextOccurrence(new Date(2025, 2, 10), "YEARLY").getFullYear()).toBe(2026);
    expect(nextOccurrence(new Date(2025, 2, 10), "WEEKLY").getDate()).toBe(17);
  });
});
