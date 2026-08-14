import { describe, it, expect } from "vitest";
import {
  toPersianDigits,
  formatNumber,
  formatDate,
  formatCategory,
  formatCell,
  formatDateTime,
  formatFitted,
} from "./format";

describe("toPersianDigits", () => {
  it("maps ASCII digits to Persian digits", () => {
    expect(toPersianDigits("1234567890")).toBe("۱۲۳۴۵۶۷۸۹۰");
  });
  it("accepts numbers and leaves non-digit chars untouched", () => {
    expect(toPersianDigits(12.5)).toBe("۱۲.۵");
    expect(toPersianDigits("$12")).toBe("$۱۲");
  });
});

describe("formatNumber", () => {
  it("groups thousands and uses ASCII in LTR", () => {
    expect(formatNumber(1234567, "ltr")).toBe("1,234,567");
  });
  it("groups thousands and uses Persian digits in RTL", () => {
    expect(formatNumber(1234567, "rtl")).toBe("۱٬۲۳۴٬۵۶۷");
  });
  it("renders null/undefined as an empty string", () => {
    expect(formatNumber(null, "rtl")).toBe("");
    expect(formatNumber(undefined, "ltr")).toBe("");
  });

  // ── Negatives in RTL ─────────────────────────────────────────────────────
  // U+002D HYPHEN-MINUS is bidi-neutral, so inside an RTL run it reorders to the END of the number:
  // «۱٬۲۳۴-» rather than «-۱٬۲۳۴». Measured on a canvas by ink-column height, with only
  // ctx.direction differing, and the chart canvas reports rtl. An isolate is the only fix that works
  // on canvas — recharts' `direction: "ltr"` trick has no canvas counterpart.

  const LRI = "⁦";
  const PDI = "⁩";

  it("wraps a negative in a directional isolate in RTL", () => {
    expect(formatNumber(-1234, "rtl")).toBe(`${LRI}-۱٬۲۳۴${PDI}`);
  });

  it("leaves positives untouched, so nothing gains invisible characters for no reason", () => {
    const out = formatNumber(1234, "rtl");
    expect(out).toBe("۱٬۲۳۴");
    expect(out).not.toContain(LRI);
    expect(out).not.toContain(PDI);
  });

  it("does not isolate in LTR, where the minus is already on the correct side", () => {
    expect(formatNumber(-1234, "ltr")).toBe("-1,234");
  });

  // Found by this test, and it predates the isolate: Intl formats -0 as "-0", so an axis tick or a
  // delta that rounded down to zero read as «-۰». Zero is not negative.
  it("shows negative zero as zero, in both directions", () => {
    expect(formatNumber(0, "rtl")).toBe("۰");
    expect(formatNumber(-0, "rtl")).toBe("۰");
    expect(formatNumber(-0, "ltr")).toBe("0");
  });

  it("still reads as the same number once the controls are stripped", () => {
    // Whatever a reader's software does with the isolate, the digits must be unchanged.
    const stripped = formatNumber(-98765, "rtl").replaceAll(LRI, "").replaceAll(PDI, "");
    expect(stripped).toBe("-۹۸٬۷۶۵");
  });
});

describe("formatDate", () => {
  it("formats an ISO date to Gregorian YYYY/MM/DD in LTR", () => {
    expect(formatDate("2026-06-22T00:00:00Z", "ltr")).toBe("2026/06/22");
  });
  it("converts Gregorian to the Persian (Jalali) calendar in RTL", () => {
    expect(formatDate("2026-06-22", "rtl")).toBe("۱۴۰۵/۰۴/۰۱");
  });
  it("passes DB Jalali strings through untouched (Persian digits in RTL)", () => {
    expect(formatDate("1405/03/16", "rtl")).toBe("۱۴۰۵/۰۳/۱۶");
    expect(formatDate("1405/03/16", "ltr")).toBe("1405/03/16");
  });
  it("renders null as an empty string", () => {
    expect(formatDate(null, "ltr")).toBe("");
  });
});

describe("formatCategory", () => {
  it("keeps year-month granularity when converting to Jalali in RTL", () => {
    expect(formatCategory("2025-05", "rtl")).toBe("۱۴۰۴/۰۲");
  });
  it("converts full Gregorian dates in RTL and leaves LTR unchanged", () => {
    expect(formatCategory("2025-05-01", "rtl")).toBe("۱۴۰۴/۰۲/۱۱");
    expect(formatCategory("2025-05", "ltr")).toBe("2025-05");
  });
  it("passes Jalali strings and plain categories through", () => {
    expect(formatCategory("1405/03/16", "rtl")).toBe("۱۴۰۵/۰۳/۱۶");
    expect(formatCategory("تهران", "rtl")).toBe("تهران");
  });
});

describe("formatCell", () => {
  it("dispatches by field type", () => {
    expect(formatCell(1000, "number", "ltr")).toBe("1,000");
    expect(formatCell("2026-01-01", "date", "ltr")).toBe("2026/01/01");
    expect(formatCell("Tehran", "string", "ltr")).toBe("Tehran");
    expect(formatCell(null, "number", "rtl")).toBe("");
  });
  it("renders string-typed DB date columns as Persian dates in RTL", () => {
    expect(formatCell("1405/03/16", "string", "rtl")).toBe("۱۴۰۵/۰۳/۱۶");
  });
});

describe("formatDateTime", () => {
  // The report viewer used to print `2026-07-26T11:47:21.8869376+00:00` verbatim.
  const utcNoon = "2026-07-26T11:47:21.8869376+00:00";

  it("does not leave an ISO string on screen", () => {
    const out = formatDateTime(utcNoon, "rtl");
    expect(out).not.toContain("T");
    expect(out).not.toContain("+00:00");
  });

  it("uses the Persian calendar and Persian digits in RTL", () => {
    const out = formatDateTime(utcNoon, "rtl");
    // July 2026 is month 5 of 1405 — a Gregorian year would read ۲۰۲۶.
    expect(out).toContain("۱۴۰۵");
    expect(out).not.toContain("2026");
  });

  it("stays Gregorian in LTR, so switching the app to English switches the calendar", () => {
    const out = formatDateTime(utcNoon, "ltr");
    expect(out).toContain("2026");
    expect(out).not.toContain("۱۴۰۵");
  });

  it("carries a time, which is the whole point of a 'last updated' field", () => {
    expect(formatDateTime(utcNoon, "ltr")).toMatch(/\d{1,2}:\d{2}/);
  });

  it("accepts a Date as well as a string", () => {
    expect(formatDateTime(new Date(utcNoon), "ltr")).toBe(formatDateTime(utcNoon, "ltr"));
  });

  it("gives back nothing for nothing, and the input for rubbish", () => {
    expect(formatDateTime(null, "rtl")).toBe("");
    expect(formatDateTime(undefined, "rtl")).toBe("");
    expect(formatDateTime("", "rtl")).toBe("");
    // never "Invalid Date"
    expect(formatDateTime("not a date", "rtl")).toBe("not a date");
  });
});

describe("formatFitted — a number in a fixed-size hole", () => {
  it("keeps the exact number when it fits", () => {
    // 9,567 is five characters. Shortening it to «۹٫۶ هزار» would lose precision for nothing.
    expect(formatFitted(9567, "rtl")).toBe("۹٬۵۶۷");
    expect(formatFitted(154109, "rtl")).toBe("۱۵۴٬۱۰۹");
    expect(formatFitted(9567, "ltr")).toBe("9,567");
  });

  it("shortens only when the full number cannot fit", () => {
    // «۱۵٬۰۴۵٬۵۰۰٬۰۰۰» is fourteen characters and drew straight over the ring.
    // ICU joins a number to its unit with U+00A0, not a plain space. The two look identical
    // on screen, which is what made this assertion fail the first time.
    expect(formatFitted(15045500000, "rtl")).toBe("۱۵ میلیارد");
    expect(formatFitted(15045500000, "ltr")).toBe("15B");
  });

  it("respects the width it is given", () => {
    // Same number, narrower space → shortened; wider space → left alone.
    expect(formatFitted(154109, "ltr", 5)).toBe("154.1K");
    expect(formatFitted(154109, "ltr", 20)).toBe("154,109");
  });

  it("has nothing to say about nothing", () => {
    expect(formatFitted(null, "rtl")).toBe("");
    expect(formatFitted(undefined, "ltr")).toBe("");
  });
});
