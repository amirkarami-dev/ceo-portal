// Ported verbatim from legacy store/mabhas19/climate.js — formulas MUST stay exact.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const M19_CLIMATE_DEFINITIONS: Record<string, string> = {
  "1": "گرم و خشک (زمستان گرم)",
  "2": "گرم و مرطوب",
  "3A": "معتدل و مرطوب",
  "3B": "چهارفصل و کم باران",
  "4": "سرد",
  "5": "خیلی سرد",
}

export const M19_CITY_CLIMATE: Array<{ province: string; city: string; climateCode: string }> = [
  { province: "آذربایجان شرقی", city: "تبریز", climateCode: "5" },
  { province: "آذربایجان غربی", city: "ارومیه", climateCode: "5" },
  { province: "اردبیل", city: "اردبیل", climateCode: "5" },
  { province: "اصفهان", city: "اصفهان", climateCode: "3B" },
  { province: "البرز", city: "کرج", climateCode: "3B" },
  { province: "ایلام", city: "ایلام", climateCode: "3B" },
  { province: "بوشهر", city: "بوشهر", climateCode: "2" },
  { province: "تهران", city: "تهران", climateCode: "3B" },
  { province: "چهارمحال و بختیاری", city: "شهرکرد", climateCode: "5" },
  { province: "خراسان جنوبی", city: "بیرجند", climateCode: "4" },
  { province: "خراسان رضوی", city: "مشهد", climateCode: "4" },
  { province: "خراسان شمالی", city: "بجنورد", climateCode: "5" },
  { province: "خوزستان", city: "اهواز", climateCode: "1" },
  { province: "زنجان", city: "زنجان", climateCode: "4" },
  { province: "سمنان", city: "سمنان", climateCode: "4" },
  { province: "سیستان و بلوچستان", city: "زاهدان", climateCode: "3B" },
  { province: "فارس", city: "شیراز", climateCode: "3B" },
  { province: "قزوین", city: "قزوین", climateCode: "3B" },
  { province: "قم", city: "قم", climateCode: "3B" },
  { province: "کردستان", city: "سنندج", climateCode: "4" },
  { province: "کرمان", city: "کرمان", climateCode: "1" },
  { province: "کرمانشاه", city: "کرمانشاه", climateCode: "4" },
  { province: "کهگیلویه و بویراحمد", city: "یاسوج", climateCode: "5" },
  { province: "گلستان", city: "گرگان", climateCode: "3A" },
  { province: "گیلان", city: "رشت", climateCode: "3A" },
  { province: "لرستان", city: "خرم آباد", climateCode: "4" },
  { province: "مازندران", city: "ساری", climateCode: "3A" },
  { province: "مرکزی", city: "اراک", climateCode: "4" },
  { province: "هرمزگان", city: "بندرعباس", climateCode: "2" },
  { province: "همدان", city: "همدان", climateCode: "5" },
  { province: "یزد", city: "یزد", climateCode: "1" },
]

export const OPAQUE_BASE_R_BY_CLIMATE: Record<string, number> = {
  "1": 0.55,
  "2": 0.88,
  "3A": 1.14,
  "3B": 1.43,
  "4": 1.87,
  "5": 2.27,
}

export const OPAQUE_TARGET_BY_3B: Record<string, number> = {
  wall_ext_open: 1.43,
  wall_ext_semi: 1.19,
  wall_soil: 0.15,
  roof_flat: 4.55,
  roof_semi: 3.85,
  floor_pilot: 2.38,
  floor_semi: 2.0,
  floor_soil: 0.27,
  door_opaque: 0.48,
  door_garage: 0.57,
}

export const OPAQUE_TARGET_LABELS: Record<string, string> = {
  wall_ext_open: "۱. دیوار خارجی مجاور فضای باز",
  wall_ext_semi: "۲. دیوار خارجی مجاور فضای نیمه باز",
  wall_soil: "۳. دیوار خارجی مجاور خاک",
  roof_flat: "۴. سقف نهایی / بام",
  roof_semi: "۵. سقف مجاور فضای نیمه باز",
  floor_pilot: "۶. کف مجاور هوای آزاد / پیلوت",
  floor_semi: "۷. کف مجاور نیمه باز",
  floor_soil: "۸. کف مجاور خاک",
  door_opaque: "۹. درهای لولادار",
  door_garage: "۱۰. درهای بدون لولا / پارکینگ",
}

const OPAQUE_TARGET_MULTIPLIERS: Record<string, number> = Object.fromEntries(
  Object.entries(OPAQUE_TARGET_BY_3B).map(([targetKey, value]) => [
    targetKey,
    value / OPAQUE_BASE_R_BY_CLIMATE["3B"],
  ])
)

export const getOpaqueTargetR = (targetKey: string, climateCode: string): number => {
  const climateBase = OPAQUE_BASE_R_BY_CLIMATE[climateCode] || OPAQUE_BASE_R_BY_CLIMATE["3B"]
  const multiplier = OPAQUE_TARGET_MULTIPLIERS[targetKey] || 1
  return Number((climateBase * multiplier).toFixed(2))
}

export const TRANS_U_LIMIT_BY_TYPE: Record<string, number> = {
  fixed: 2.38,
  operable: 3.03,
  door: 3.84,
  skylight: 2.38,
}

const TRANS_SHGC_LIMITS: Record<string, Array<{ maxPf: number; limit: number }>> = {
  warm: [
    { maxPf: 0.2, limit: 0.4 },
    { maxPf: 0.5, limit: 0.5 },
    { maxPf: 0.75, limit: 0.6 },
    { maxPf: Infinity, limit: 0.7 },
  ],
  normal: [
    { maxPf: 0.2, limit: 0.3 },
    { maxPf: 0.5, limit: 0.36 },
    { maxPf: 0.75, limit: 0.48 },
    { maxPf: Infinity, limit: 0.58 },
  ],
}

export const isWarmClimate = (climateCode: string): boolean =>
  climateCode === "1" || climateCode === "2"

export const getTransShgcLimit = (climateCode: string, pfValue: number): number => {
  const pf = Number.isFinite(pfValue) ? pfValue : 0
  const table = isWarmClimate(climateCode) ? TRANS_SHGC_LIMITS.warm : TRANS_SHGC_LIMITS.normal
  const entry = table.find((item) => pf < item.maxPf) || table[table.length - 1]
  return entry.limit
}

export const getCityClimate = (cityName: string): string => {
  const item = M19_CITY_CLIMATE.find((x) => x.city === cityName)
  return item?.climateCode || "4"
}
