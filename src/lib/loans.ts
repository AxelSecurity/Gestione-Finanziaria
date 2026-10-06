export interface AmortRow { n: number; interest: number; principal: number; payment: number; balance: number }

/** Rata costante (francese). Importi in centesimi. */
export function monthlyPayment(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return Math.round(principal / months);
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

export function amortization(principal: number, annualRatePct: number, months: number, payment?: number): AmortRow[] {
  const r = annualRatePct / 100 / 12;
  const pay = payment ?? monthlyPayment(principal, annualRatePct, months);
  const rows: AmortRow[] = [];
  let balance = principal;
  for (let n = 1; n <= months; n++) {
    const interest = Math.round(balance * r);
    let princ = pay - interest;
    let p = pay;
    if (n === months || princ > balance) { princ = balance; p = balance + interest; }
    balance -= princ;
    rows.push({ n, interest, principal: princ, payment: p, balance });
  }
  return rows;
}
