export type Bucket = "NEEDS" | "WANTS" | "SAVINGS";

export interface Targets { needs: number; wants: number; savings: number }
export interface BucketReport {
  bucket: Bucket;
  spent: number;       // centesimi
  target: number;      // centesimi, % del reddito
  actualPct: number;
  targetPct: number;
  remaining: number;   // target - spent (negativo = sforato)
  over: boolean;
}

/**
 * Confronta le spese del mese per bucket con i target % del reddito.
 * Il bucket SAVINGS conta come "obiettivo minimo" (over = hai risparmiato meno del target).
 */
export function compute503020(
  income: number,
  spent: Record<Bucket, number>,
  targets: Targets = { needs: 50, wants: 30, savings: 20 },
): BucketReport[] {
  const pctMap: Record<Bucket, number> = { NEEDS: targets.needs, WANTS: targets.wants, SAVINGS: targets.savings };
  return (["NEEDS", "WANTS", "SAVINGS"] as Bucket[]).map((bucket) => {
    const target = Math.round((income * pctMap[bucket]) / 100);
    const s = spent[bucket] ?? 0;
    return {
      bucket,
      spent: s,
      target,
      actualPct: income > 0 ? (s / income) * 100 : 0,
      targetPct: pctMap[bucket],
      remaining: target - s,
      over: bucket === "SAVINGS" ? s < target : s > target,
    };
  });
}
