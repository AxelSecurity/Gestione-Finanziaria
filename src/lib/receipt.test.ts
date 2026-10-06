import { describe, it, expect } from "vitest";
import { parseReceipt, parseAmount, parseDate } from "./receipt";

const SAMPLE = `CONAD SUPERMERCATO
VIA ROMA 12 - MILANO
P.IVA 01234567890
LATTE INTERO         1,29
PANE                 2,10
PASTA 500G           0,89
TOTALE COMPLESSIVO   24,50
CONTANTI             30,00
RESTO                 5,50
IVA 4%                0,98
03/10/2026 18:42`;

describe("parseReceipt", () => {
  it("estrae totale, data, negozio, categoria", () => {
    const r = parseReceipt(SAMPLE, new Date(2026, 9, 5));
    expect(r.amount).toBe(2450);
    expect(r.date).toBe("2026-10-03");
    expect(r.merchant).toBe("CONAD SUPERMERCATO");
    expect(r.categoryHint).toBe("Spesa alimentare");
  });
  it("senza parola TOTALE usa l'importo massimo, ignorando resto/iva", () => {
    expect(parseAmount("CAFFE 1,20\nCORNETTO 1,50\nRESTO 7,30")).toBe(150);
  });
  it("migliaia e correzioni OCR", () => {
    expect(parseAmount("TOTALE 1.234,56")).toBe(123456);
    expect(parseAmount("TOTALE 2O,5O")).toBe(2050);
  });
  it("date a 2 cifre e separatori diversi", () => {
    expect(parseDate("del 5-3-26", new Date(2026, 9, 5))).toBe("2026-03-05");
    expect(parseDate("31.12.2025")).toBe("2025-12-31");
    expect(parseDate("nessuna data")).toBeNull();
  });
});
