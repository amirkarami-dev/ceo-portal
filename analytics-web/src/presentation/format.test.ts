import { describe, it, expect } from "vitest";
import {
  toPersianDigits,
  formatNumber,
  formatDate,
  formatCategory,
  formatCell,
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
