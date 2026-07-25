// Ported verbatim from legacy legacy-data — data values & formulas unchanged.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const INTEGRATED_TOOL_MAX_SCORE = 77

export const INTEGRATED_USAGE_OPTIONS = [
  { value: "res", label: "۱. مسکونی ≥ ۳۰۰۰ مترمربع" },
  { value: "res", label: "۲. مسکونی < ۳۰۰۰ مترمربع" },
  { value: "res", label: "۳. ویلایی" },
  { value: "pub", label: "۴. اداری عمومی" },
  { value: "pub", label: "۵. اداری خصوصی" },
  { value: "pub", label: "۶. بانک و موسسه مالی" },
  { value: "pub", label: "۷. بیمارستان" },
  { value: "pub", label: "۸. تشخیص پزشکی / آزمایشگاه" },
  { value: "pub", label: "۹. کلینیک تشخیصی" },
  { value: "pub", label: "۱۰. کلینیک بدون بستری" },
  { value: "pub", label: "۱۱. مطب پزشکی" },
  { value: "pub", label: "۱۲. مراکز نگهداری / پرستاری" },
  { value: "pub", label: "۱۳. دانشگاه و آموزش عالی" },
  { value: "pub", label: "۱۴. دبیرستان" },
  { value: "pub", label: "۱۵. دبستان و پیش دبستان" },
  { value: "pub", label: "۱۶. مهد کودک" },
  { value: "pub", label: "۱۷. کتابخانه" },
  { value: "pub", label: "۱۸. مسجد" },
  { value: "pub", label: "۱۹. فرهنگی / سرگرمی" },
  { value: "pub", label: "۲۰. هتل" },
  { value: "pub", label: "۲۱. مسافرخانه / مهمانسرا" },
  { value: "pub", label: "۲۲. خوابگاه" },
  { value: "pub", label: "۲۳. هایپر مارکت / سوپر مارکت" },
  { value: "pub", label: "۲۴. فست فود" },
  { value: "pub", label: "۲۵. رستوران / کافه" },
  { value: "pub", label: "۲۶. تجاری / فروشگاه" },
  { value: "pub", label: "۲۷. مرکز خرید / مال" },
  { value: "pub", label: "۲۸. کلانتری / آتش نشانی" },
  { value: "pub", label: "۲۹. دفتر پست" },
  { value: "pub", label: "۳۰. نمایشگاه خودرو" },
  { value: "pub", label: "۳۱. تعمیرگاه خودرو" },
  { value: "pub", label: "۳۲. انبار یخچال‌دار" },
  { value: "pub", label: "۳۳. سوله با تهویه (صنعتی)" },
  { value: "pub", label: "۳۴. سوله بدون تهویه (صنعتی)" },
]

export const INTEGRATED_ITEMS = [
  {
    alpha: "ب",
    text: "آیا این سامانه باید علاوه بر قابلیتهای سامانه مدیریت ساختمان (BMS) و سامانه مدیریت انرژی ساختمان (EMS) توانایی ارسال اطلاعات به درگاه سامانه واپایش انرژی ساختمانها را بر اساس الزامات فصل هفتم این مبحث دارا است؟",
    target: "مخاطب: تمام ساختمانهایی که طراحی و اجرای سامانه مدیریت یکپارچه ساختمان در آنها الزامی است",
  },
  {
    alpha: "ب",
    text: "آیا هیچ تجهیز و یا بخش از سامانه های تأسیسات مکانیکی و الکتریکی بدون اتصال و ارتباط با این سامانه در ساختمان وجود دارد؟",
    target: "مخاطب: تمام ساختمانهایی که طراحی و اجرای سامانه مدیریت یکپارچه ساختمان در آنها الزامی است",
  },
  {
    alpha: "ت",
    text: "آیا تمامی نقشه های مربوط به این سامانه توسط مهندس طراح تأسیسات الکتریکی با همراهی و هم فکری مهندس طراح تأسیسات مکانیکی تهیه شده و با تأیید هر دو برای دریافت پروانه ساخت ارائه شده است؟",
    target: "مخاطب: تمام ساختمانهایی که طراحی و اجرای سامانه مدیریت یکپارچه ساختمان در آنها الزامی است",
  },
]

export const getIntegratedAutoActivation = ({
  usage,
  totalArea,
  floorCount,
}: {
  usage?: string
  totalArea?: number | null
  floorCount?: number | null
}): boolean => {
  const area = Number(totalArea) || 0
  const floors = Number(floorCount) || 0

  if (usage === "pub" && area > 10000) {
    return true
  }

  if (usage === "res" && (area > 5000 || floors > 9)) {
    return true
  }

  return false
}
