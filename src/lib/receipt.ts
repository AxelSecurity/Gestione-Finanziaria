export interface ParsedReceipt {
  amount: number | null; // centesimi
  date: string | null;   // YYYY-MM-DD
  merchant: string;
  categoryHint: string | null; // nome categoria suggerita
}

const AMOUNT = /(?<![\d.,])(\d{1,3}(?:[. ]\d{3})*|\d+)\s?[.,]\s?(\d{2})(?!\d)/g;
const TOTAL_KEYS = /(totale|total|importo\s*(pagato|da\s*pagare)?|da\s*pagare|pagamento|euro\s*$)/i;
const NOT_TOTAL = /(resto|iva|imponibile|sconto|contanti|subtotale|punti|imposta|\bpr\.?\s*unit|%)/i;

const toCents = (m: RegExpMatchArray) => parseInt(m[1].replace(/[. ]/g, "") + m[2], 10);

/** Corregge gli errori OCR tipici nei numeri (O→0, l→1, S→5) solo quando il token sembra un importo. */
function fixDigits(line: string) {
  return line.replace(/\b[\dOolIS]{1,5}\s?[.,]\s?[\dOolIS]{2}\b/g, (t) => t.replace(/[Oo]/g, "0").replace(/[lI]/g, "1").replace(/S/g, "5"));
}

export function parseAmount(text: string): number | null {
  const lines = text.split(/\r?\n/).map(fixDigits);
  const keyed: number[] = [];
  const all: number[] = [];
  for (const line of lines) {
    const found = [...line.matchAll(AMOUNT)].map(toCents).filter((n) => n > 0);
    if (!found.length || NOT_TOTAL.test(line)) continue;
    all.push(...found);
    if (TOTAL_KEYS.test(line)) keyed.push(found[found.length - 1]);
  }
  if (keyed.length) return Math.max(...keyed);
  return all.length ? Math.max(...all) : null;
}

export function parseDate(text: string, now = new Date()): string | null {
  const re = /(?<!\d)(\d{1,2})\s?[\/.\-]\s?(\d{1,2})\s?[\/.\-]\s?(\d{4}|\d{2})(?!\d)/g;
  for (const m of text.matchAll(re)) {
    const d = +m[1], mo = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > now.getFullYear() + 1) continue;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

export function parseMerchant(text: string): string {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[^A-Za-zÀ-ÿ0-9 &'.\-]/g, " ").replace(/\s+/g, " ").trim();
    const letters = (line.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
    if (letters >= 3 && letters / line.length > 0.6 && !/^(scontrino|documento|ricevuta|fattura)/i.test(line)) return line.slice(0, 40);
  }
  return "";
}

// parole chiave → nome categoria predefinita
const HINTS: [RegExp, string][] = [
  [/(conad|coop|esselunga|carrefour|lidl|eurospin|md\b|pam\b|despar|supermerc|ipercoop|penny|aldi|iper\b|alimentar|macelleria|panetteria|ortofrutta)/i, "Spesa alimentare"],
  [/(farmacia|parafarmacia|ottica|dentist|medic|clinica|ambulatorio)/i, "Salute"],
  [/(benzina|carburante|eni\b|q8|tamoil|esso|ip\b|autostrad|telepass|parcheggio|trenitalia|italo|taxi|gasolio|diesel)/i, "Trasporti"],
  [/(ristorante|pizzeria|trattoria|osteria|bar\b|caff[eè]|pub\b|sushi|mcdonald|burger|gelateria|pasticceria)/i, "Ristoranti e bar"],
  [/(zara|h&m|decathlon|ikea|amazon|mediaworld|unieuro|abbigliamento|scarpe|leroy|brico)/i, "Shopping"],
  [/(cinema|teatro|museo|concerto|biglietto|bowling|parco)/i, "Svago"],
  [/(hotel|b&b|booking|airbnb|ryanair|easyjet|alitalia|volo)/i, "Viaggi"],
];

export function suggestCategory(text: string): string | null {
  for (const [re, name] of HINTS) if (re.test(text)) return name;
  return null;
}

export function parseReceipt(text: string, now = new Date()): ParsedReceipt {
  return { amount: parseAmount(text), date: parseDate(text, now), merchant: parseMerchant(text), categoryHint: suggestCategory(text) };
}
