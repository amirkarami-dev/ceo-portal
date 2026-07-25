"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "fa" | "ku";

const LANG_KEY = "kurdnezam-lang";

/* ── UI chrome dictionaries (fa = default, ku = Sorani) ── */
const dictionaries = {
  fa: {
    // brand
    "brand.name": "سازمان نظام مهندسی ساختمان",
    "brand.province": "استان کردستان",
    // nav
    "nav.home": "صفحه نخست",
    "nav.news": "اخبار و رویدادها",
    "nav.allNews": "همه اخبار",
    "nav.organs": "ارکان سازمان",
    "nav.units": "واحدهای سازمان",
    "nav.contact": "تماس با ما",
    "nav.cartable": "کارتابل مهندس",
    "nav.cartableLong": "ورود به کارتابل مهندس",
    "nav.menu": "فهرست سایت",
    "nav.search": "جستجو در اخبار و اطلاعیه‌ها…",
    // organs submenu
    "organs.board": "هیئت مدیره",
    "organs.presidium": "هیئت رئیسه",
    "organs.inspectors": "بازرسین",
    "organs.disciplinary": "شورای انتظامی",
    "organs.assembly": "مجمع عمومی",
    // hero
    "hero.title1": "سازمان",
    "hero.title2": "نظام مهندسی ساختمان",
    "hero.title3": "استان کردستان",
    "hero.tagline":
      "مرجع رسمی خدمات مهندسی ساختمان در استان کردستان (از عضویت و صدور پروانه تا خدمات مهندسی، نظارت، آموزش و ... ؛ همه در یک درگاه).",
    "hero.newsBtn": "آخرین اخبار و اطلاعیه‌ها",
    "hero.aboutBtn": "آشنایی با سازمان",
    "hero.viewNews": "مشاهده خبر",
    "hero.statMembers": "عضو فعال",
    "hero.statGroups": "رشته تخصصی",
    "hero.statOffices": "دفتر نمایندگی",
    // home sections
    "home.fresh": "تازه‌ها",
    "home.latestNews": "آخرین اخبار و اطلاعیه‌ها",
    "home.latestNewsSub": "آخرین رویدادها و اطلاعیه‌های سازمان",
    "home.viewAllNews": "مشاهده همه اخبار",
    "home.unitsTitle": "واحدهای سازمان و گروه‌های تخصصی",
    "home.unitsSub":
      "دسترسی سریع به بخش‌ها، پرتال‌ها، کارگروه‌ها و معرفی اعضای سازمان نظام مهندسی",
    "home.formsTitle": "فرم‌ها و نظرسنجی‌ها",
    "home.formsSub": "طرح نظرات، شکایات و دریافت خدمات الکترونیک",
    "home.approvals": "مصوبات هیات مدیره",
    "home.approvalsSub": "آخرین مصوبات و تصمیمات هیئت مدیره سازمان",
    "home.viewAll": "مشاهده همه",
    "home.unitPage": "صفحه اختصاصی",
    "home.view": "مشاهده",
    "home.soon": "به‌زودی",
    "home.deadline": "مهلت",
    "home.enterForm": "ورود و تکمیل",
    "home.noNews": "هیچ خبری در این دسته‌بندی یافت نشد.",
    "home.activeForms": "فرم‌های فعال",
    "home.archive": "آرشیو کامل اخبار",
    // shared
    "common.home": "خانه",
    "common.readMore": "مطالعه کامل خبر",
    "common.openFull": "صفحه کامل خبر",
    "common.close": "بستن",
    "common.members": "معرفی اعضا و مسئولین",
    // news page
    "news.title": "اخبار سازمان",
    "news.subtitle":
      "آخرین رویدادها، اخبار و گزارش‌های تصویری سازمان نظام مهندسی ساختمان کردستان",
    "news.category": "دسته‌بندی:",
    "news.all": "همه اخبار",
    // footer
    "footer.links": "پیوندها",
    "footer.usefulLinks": "پیوندهای مفید",
    "footer.contact": "تماس با ما",
    "footer.totalVisits": "تعداد کل بازدید:",
    "footer.todayVisits": "بازدید امروز:",
    "footer.online": "افراد آنلاین:",
    "footer.socials": "شبکه‌های اجتماعی:",
    "footer.postal": "کدپستی",
    "footer.rights":
      "© ۱۴۰۵ تمامی حقوق برای سازمان نظام مهندسی ساختمان استان کردستان محفوظ است.",
    "footer.privacy": "حریم خصوصی",
    "footer.terms": "شرایط استفاده",
    "footer.admin": "پنل مدیریت",
  },
  ku: {
    // brand
    "brand.name": "ڕێکخراوی سیستەمی ئەندازیاری بیناسازی",
    "brand.province": "پارێزگای کوردستان",
    // nav
    "nav.home": "پەڕەی سەرەکی",
    "nav.news": "هەواڵ و ڕووداوەکان",
    "nav.allNews": "هەموو هەواڵەکان",
    "nav.organs": "ئۆرگانەکانی ڕێکخراو",
    "nav.units": "یەکەکانی ڕێکخراو",
    "nav.contact": "پەیوەندی بە ئێمەوە",
    "nav.cartable": "کارتابلی ئەندازیار",
    "nav.cartableLong": "چوونەژوورەوە بۆ کارتابلی ئەندازیار",
    "nav.menu": "لیستی ماڵپەڕ",
    "nav.search": "گەڕان لە هەواڵ و ڕاگەیاندنەکاندا…",
    // organs submenu
    "organs.board": "دەستەی بەڕێوەبردن",
    "organs.presidium": "دەستەی سەرۆکایەتی",
    "organs.inspectors": "پشکنەران",
    "organs.disciplinary": "ئەنجومەنی تەمبیهی",
    "organs.assembly": "کۆبوونەوەی گشتی",
    // hero
    "hero.title1": "ڕێکخراوی",
    "hero.title2": "ئەندازیاریی بیناسازی",
    "hero.title3": "پارێزگای کوردستان",
    "hero.tagline":
      "سەرچاوەی فەرمی خزمەتگوزارییە ئەندازیارییەکانی بیناسازی لە پارێزگای کوردستان — لە ئەندامەتی و دەرکردنی مۆڵەتەوە تا خزمەتگوزاری ئەندازیاری، چاودێری و فێرکردن؛ هەموو لە یەک دەروازەدا.",
    "hero.newsBtn": "دوایین هەواڵ و ڕاگەیاندنەکان",
    "hero.aboutBtn": "ناسینی ڕێکخراو",
    "hero.viewNews": "بینینی هەواڵ",
    "hero.statMembers": "ئەندامی چالاک",
    "hero.statGroups": "بواری پسپۆڕی",
    "hero.statOffices": "نووسینگەی نوێنەرایەتی",
    // home sections
    "home.fresh": "تازەکان",
    "home.latestNews": "دوایین هەواڵ و ڕاگەیاندنەکان",
    "home.latestNewsSub": "دوایین ڕووداو و ڕاگەیاندنەکانی ڕێکخراو",
    "home.viewAllNews": "بینینی هەموو هەواڵەکان",
    "home.unitsTitle": "یەکەکانی ڕێکخراو و گرووپە پسپۆڕییەکان",
    "home.unitsSub":
      "دەستگەیشتنی خێرا بە بەشەکان، پۆرتاڵەکان، گرووپەکانی کار و ناساندنی ئەندامانی ڕێکخراو",
    "home.formsTitle": "فۆڕمەکان و ڕاپرسییەکان",
    "home.formsSub": "پێشکەشکردنی بۆچوون، سکاڵا و وەرگرتنی خزمەتگوزاری ئەلیکترۆنی",
    "home.approvals": "بڕیارەکانی دەستەی بەڕێوەبردن",
    "home.approvalsSub": "دوایین بڕیارەکانی دەستەی بەڕێوەبردنی ڕێکخراو",
    "home.viewAll": "بینینی هەموو",
    "home.unitPage": "پەڕەی تایبەت",
    "home.view": "بینین",
    "home.soon": "بەم زووانە",
    "home.deadline": "مۆڵەت",
    "home.enterForm": "چوونەژوورەوە و پڕکردنەوە",
    "home.noNews": "هیچ هەواڵێک لەم پۆلێنەدا نەدۆزرایەوە.",
    "home.activeForms": "فۆڕمە چالاکەکان",
    "home.archive": "ئەرشیفی تەواوی هەواڵەکان",
    // shared
    "common.home": "ماڵەوە",
    "common.readMore": "خوێندنەوەی تەواوی هەواڵ",
    "common.openFull": "پەڕەی تەواوی هەواڵ",
    "common.close": "داخستن",
    "common.members": "ناساندنی ئەندامان و بەرپرسان",
    // news page
    "news.title": "هەواڵەکانی ڕێکخراو",
    "news.subtitle":
      "دوایین ڕووداو، هەواڵ و ڕاپۆرتە وێنەییەکانی ڕێکخراوی سیستەمی ئەندازیاری بیناسازیی کوردستان",
    "news.category": "پۆلێن:",
    "news.all": "هەموو هەواڵەکان",
    // footer
    "footer.links": "بەستەرەکان",
    "footer.usefulLinks": "بەستەرە بەسوودەکان",
    "footer.contact": "پەیوەندی بە ئێمەوە",
    "footer.totalVisits": "کۆی سەردانەکان:",
    "footer.todayVisits": "سەردانی ئەمڕۆ:",
    "footer.online": "کەسانی سەرهێڵ:",
    "footer.socials": "تۆڕە کۆمەڵایەتییەکان:",
    "footer.postal": "کۆدی پۆستە",
    "footer.rights":
      "© ١٤٠٥ هەموو مافەکان بۆ ڕێکخراوی سیستەمی ئەندازیاری بیناسازیی پارێزگای کوردستان پارێزراوە.",
    "footer.privacy": "تایبەتمەندی",
    "footer.terms": "مەرجەکانی بەکارهێنان",
    "footer.admin": "پانێڵی بەڕێوەبردن",
  },
} as const;

export type TKey = keyof (typeof dictionaries)["fa"];

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey) => string;
}

const I18nContext = createContext<I18n>({
  lang: "fa",
  setLang: () => {},
  t: (key) => dictionaries.fa[key],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("fa");

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "ku" || saved === "fa") setLangState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
  }, []);

  const t = useCallback(
    (key: TKey) => dictionaries[lang][key] ?? dictionaries.fa[key],
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
