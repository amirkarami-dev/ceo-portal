// Ported verbatim from legacy legacy-data/envTransDb.js — data values unchanged.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const ENV_TRANS_STANDARDS = {
  glass_float: "10673-2",
  glass_tempered: "2385",
  glass_dgu: "8521-1",
  profile_upvc: "12291-1",
  fittings: "19091-19",
}

const STANDARDS = ENV_TRANS_STANDARDS

export const ENV_TRANS_GLASS_DB: any[] = [
  { n: "شیشه فلوت شفاف ساده (4mm)", l: 1.0, std: STANDARDS.glass_float, shgc: 0.83, vlt: 88 },
  { n: "شیشه فلوت شفاف ساده (6mm)", l: 1.0, std: STANDARDS.glass_float, shgc: 0.81, vlt: 87 },
  { n: "شیشه رفلکس نقره‌ای (Super Silver)", l: 1.0, std: STANDARDS.glass_float, shgc: 0.45, vlt: 30 },
  { n: "شیشه رفلکس دودی/برنز", l: 1.0, std: STANDARDS.glass_float, shgc: 0.5, vlt: 40 },
  { n: "شیشه Low-E (کم‌گسیل خنثی)", l: 1.0, std: STANDARDS.glass_float, shgc: 0.55, vlt: 75 },
  { n: "شیشه Low-E (High Performance)", l: 1.0, std: STANDARDS.glass_float, shgc: 0.35, vlt: 65 },
  { n: "شیشه لمینت (PVB 0.76)", l: 0.9, std: STANDARDS.glass_float, shgc: 0.7, vlt: 85 },
]

export const ENV_TRANS_GAS_DB: any[] = [
  { n: "هوای خشک (Air) - 12mm", l: 0.026, def_th: 12 },
  { n: "گاز آرگون (Argon) - 12mm", l: 0.018, def_th: 12 },
  { n: "گاز کریپتون (Krypton)", l: 0.009, def_th: 12 },
  { n: "بدون فاصله (تک جداره)", l: 0, def_th: 0 },
]

export const ENV_TRANS_PROFILE_DB: any[] = [
  { n: "پروفیل UPVC استاندارد (3 کاناله)", u_f: 2.2, std: STANDARDS.profile_upvc },
  { n: "پروفیل UPVC (5 کاناله)", u_f: 1.8, std: STANDARDS.profile_upvc },
  { n: "آلومینیوم نرمال (بدون ترمال)", u_f: 5.0, std: "-" },
  { n: "آلومینیوم ترمال بریک (12mm)", u_f: 3.0, std: "-" },
  { n: "آلومینیوم ترمال بریک (24mm)", u_f: 2.4, std: "-" },
  { n: "آهنی / فولادی", u_f: 5.5, std: "-" },
]

export const ENV_TRANS_PRESETS: Record<string, any> = {
  fixed_window: {
    title: "پنجره ثابت (UPVC دوجداره)",
    type: "fixed",
    l1_idx: 1,
    l2_idx: 0,
    l3_idx: 0,
    f_idx: 0,
    shgc: 0.7,
    vlt: 75,
  },
  operable_window: {
    title: "پنجره بازشو (UPVC دوجداره)",
    type: "operable",
    l1_idx: 1,
    l2_idx: 1,
    l3_idx: 0,
    f_idx: 0,
    shgc: 0.7,
    vlt: 75,
  },
  glass_door: {
    title: "در شیشه‌ای (سکوریت)",
    type: "door",
    l1_idx: 6,
    l2_idx: 0,
    l3_idx: 6,
    f_idx: 3,
    shgc: 0.65,
    vlt: 70,
  },
  skylight: {
    title: "نورگیر سقفی (لمینت ایمنی)",
    type: "skylight",
    l1_idx: 6,
    l2_idx: 1,
    l3_idx: 4,
    f_idx: 4,
    shgc: 0.4,
    vlt: 60,
  },
}
