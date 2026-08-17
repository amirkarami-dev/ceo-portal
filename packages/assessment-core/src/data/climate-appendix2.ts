/**
 * پیوست ۲ of the **fifth** edition of Section 19 — «دسته‌بندی اقلیمی شهرهای ایران».
 *
 * Transcribed from `docs/mabhas19/پیوست2-ویرایش-پنجم-مبحث-نوزدهم-مقررات-ملی-ساختمان.pdf`: all 76
 * rows, in the printed order, row numbers kept in comments so the table can be audited against the
 * document line by line. The PDF's Persian glyphs carry no Unicode mapping, so the pages were read
 * as images; the zone codes were then cross-checked against the PDF's text layer, which extracts
 * them (and only them) correctly. Both readings agree on all 76.
 *
 * The document's closing note states the basis: **ANSI/ASHRAE 169-2020**, from ten years of Iranian
 * Meteorological Organization data, and says further stations will be added to the table as their
 * analysis completes. So absence here means "not published yet", not "no climate class".
 *
 * ## This is REFERENCE DATA. It is NOT a calculation input.
 *
 * The scoring in `climate.ts` is keyed to a different, older zoning — `1, 2, 3A, 3B, 4, 5` with
 * Persian names — and every required R-value, U-limit and SHGC row hangs off those keys. The two
 * systems are not one list relabelled:
 *
 * - **25 of the 31 cities** the app offers land in a different class here (اهواز `1` → `0B`,
 *   تبریز `5` → `4B`, مشهد `4` → `3B`, یزد `1` → `2B`, …). Five coincide, and one — زاهدان — is not
 *   in the document at all.
 * - Where the strings *do* coincide they do not mean the same thing: `3B` is «چهارفصل و کم باران»
 *   in the older scheme and warm-dry in ASHRAE 169. Coincidence, not corroboration.
 * - Eight of the classes used here — `0B`, `1B`, `2A`, `2B`, `4A`, `4B`, `5B`, `5C` — are not keys
 *   in `OPAQUE_BASE_R_BY_CLIMATE` at all. Passing one to `getOpaqueTargetR` would miss the lookup
 *   and **silently** fall back to the `3B` base, scoring a building against the wrong requirement.
 *
 * So these values are shown *beside* the climate code, never substituted for it. Moving the
 * assessment itself onto this zoning needs the fifth edition's own requirement tables, which are
 * not in this appendix.
 */
export interface Appendix2Row {
  /** City name exactly as printed — station name included where the document names one. */
  city: string
  /** «رده اقلیمی» per ANSI/ASHRAE 169-2020. */
  climateClass: string
}

export const M19_APPENDIX2_ROWS: ReadonlyArray<Appendix2Row> = [
  { city: "آبادان", climateClass: "0B" }, // 1
  { city: "آباده", climateClass: "4B" }, // 2
  { city: "آقاجاری", climateClass: "0B" }, // 3
  { city: "اراک", climateClass: "4B" }, // 4
  { city: "اردبیل", climateClass: "5C" }, // 5
  { city: "ارومیه", climateClass: "4B" }, // 6
  { city: "اصفهان", climateClass: "4B" }, // 7
  { city: "کرج", climateClass: "3B" }, // 8 — printed here, out of alphabetical order
  { city: "الیگودرز", climateClass: "4A" }, // 9
  { city: "انزلی", climateClass: "3A" }, // 10
  { city: "اهر", climateClass: "4B" }, // 11
  { city: "اهواز", climateClass: "0B" }, // 12
  { city: "ایرانشهر", climateClass: "0B" }, // 13
  { city: "ایلام", climateClass: "3A" }, // 14
  { city: "بابلسر", climateClass: "3A" }, // 15
  { city: "بازرگان", climateClass: "5B" }, // 16
  { city: "بافت", climateClass: "3B" }, // 17
  { city: "بجنورد", climateClass: "4B" }, // 18
  { city: "بم", climateClass: "1B" }, // 19
  { city: "بندر بوشهر", climateClass: "1B" }, // 20
  { city: "بندر لنگه", climateClass: "0B" }, // 21
  { city: "بندر ماهشهر", climateClass: "1B" }, // 22
  { city: "بندرعباس", climateClass: "0B" }, // 23
  { city: "بیرجند", climateClass: "3B" }, // 24
  { city: "پارس آباد مغان", climateClass: "3B" }, // 25
  { city: "تبریز", climateClass: "4B" }, // 26
  { city: "تربت حیدریه", climateClass: "4B" }, // 27
  { city: "تهران (امام خمینی)", climateClass: "3B" }, // 28
  { city: "تهران (مهرآباد)", climateClass: "3B" }, // 29
  { city: "جاسک", climateClass: "0B" }, // 30
  { city: "چابهار", climateClass: "0B" }, // 31
  { city: "خرم آباد", climateClass: "3A" }, // 32
  { city: "خور", climateClass: "2B" }, // 33
  { city: "خوی", climateClass: "4B" }, // 34
  { city: "دیر", climateClass: "0B" }, // 35
  { city: "رامسر", climateClass: "3A" }, // 36
  { city: "رشت", climateClass: "3A" }, // 37
  { city: "زابل", climateClass: "1B" }, // 38
  { city: "زنجان", climateClass: "4B" }, // 39
  { city: "زهبندان", climateClass: "2B" }, // 40 — زهبندان, NOT زاهدان; zoomed in to be sure
  { city: "ساری", climateClass: "3A" }, // 41
  { city: "سبزوار", climateClass: "2B" }, // 42
  { city: "سراب", climateClass: "5B" }, // 43
  { city: "سراوان", climateClass: "2B" }, // 44
  { city: "سرخس", climateClass: "2B" }, // 45
  { city: "سقز", climateClass: "4A" }, // 46
  { city: "سمنان", climateClass: "2B" }, // 47
  { city: "سنندج", climateClass: "4A" }, // 48
  { city: "سیرجان", climateClass: "3B" }, // 49
  { city: "شاهرود", climateClass: "4B" }, // 50
  { city: "شهرکرد", climateClass: "4A" }, // 51
  { city: "شیراز", climateClass: "3B" }, // 52
  { city: "طبس", climateClass: "2B" }, // 53
  { city: "قائمشهر", climateClass: "3A" }, // 54
  { city: "قزوین", climateClass: "4B" }, // 55
  { city: "قم", climateClass: "2B" }, // 56
  { city: "قشم", climateClass: "0B" }, // 57
  { city: "قوچان", climateClass: "4B" }, // 58
  { city: "کاشان", climateClass: "2B" }, // 59
  { city: "کاشمر", climateClass: "2B" }, // 60
  { city: "کرمان", climateClass: "3B" }, // 61
  { city: "کرمانشاه", climateClass: "4A" }, // 62
  { city: "کهنوج", climateClass: "0B" }, // 63
  { city: "کیش", climateClass: "0B" }, // 64
  { city: "گچساران", climateClass: "2A" }, // 65
  { city: "گرگان", climateClass: "3B" }, // 66
  { city: "لار", climateClass: "1B" }, // 67
  { city: "مراغه", climateClass: "4B" }, // 68
  { city: "مشهد", climateClass: "3B" }, // 69
  { city: "مهاباد", climateClass: "4A" }, // 70
  { city: "میانه", climateClass: "4B" }, // 71
  { city: "نهبندان", climateClass: "2B" }, // 72
  { city: "نوشهر", climateClass: "3A" }, // 73
  { city: "همدان", climateClass: "4A" }, // 74
  { city: "یاسوج", climateClass: "3A" }, // 75
  { city: "یزد", climateClass: "2B" }, // 76
]

export const M19_APPENDIX2_CLASS: Record<string, string> = Object.fromEntries(
  M19_APPENDIX2_ROWS.map((row) => [row.city, row.climateClass])
)

/**
 * The project form offers city names; the appendix sometimes names the weather station instead.
 * Kept as an explicit pair per case rather than as name-normalising cleverness — two entries are
 * auditable against the document, a normaliser is a rule nobody can check.
 */
export const M19_APPENDIX2_ALIASES: Record<string, string> = {
  // The appendix lists the port, the app the province capital. Same city.
  بوشهر: "بندر بوشهر",
  // Tehran appears twice, as its two stations. Both are 3B, so the choice cannot change an answer;
  // مهرآباد is the long-running synoptic station.
  تهران: "تهران (مهرآباد)",
}

/**
 * «رده اقلیمی» for a city, or `undefined` when the appendix does not list it — which today is true
 * of زاهدان among the cities the app offers. `undefined` means "not in the document", and the
 * caller must say so rather than substituting a neighbour or a default: a guessed climate class is
 * indistinguishable on screen from a published one.
 */
export function getCityAppendix2Class(cityName: string): string | undefined {
  const key = M19_APPENDIX2_ALIASES[cityName] ?? cityName
  return M19_APPENDIX2_CLASS[key]
}
