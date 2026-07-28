import type { SemanticModel } from "../../contracts/semantic";

// Frontend mirror of the backend welfare semantic models
// (src/Infrastructure/Analytics/Sql/WalfareSemanticModelStore.cs). Used in REAL mode
// (VITE_USE_MOCK_API="false") for the Ask-AI dataset picker + auto-viz role hints.
// The backend remains authoritative for AI grounding + SQL; ids/sources/fields MUST match it.
//
// These tables live in CeoDb, not the KurdNezam warehouse — the backend model carries the
// connection, so nothing here needs to know. Personal data (کد ملی، موبایل، شماره کارت) is
// deliberately absent from both sides.

export const walfareReservationsModel: SemanticModel = {
  id: "model-walfare-reservations",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "رزروهای سامانه رفاهی", "en-US": "Welfare Reservations" },
  entities: [
    {
      id: "walfare_reservations",
      source: "walfare_reservations",
      name: { "fa-IR": "رزرو", "en-US": "Reservation" },
      description: {
        "fa-IR": "رزرو بلیط خدمات رفاهی مهندسان به همراه وضعیت پرداخت و مبلغ",
        "en-US": "Welfare service ticket reservations with payment status and amount",
      },
      fields: [
        { id: "PoolId", column: "PoolId", type: "number", role: "dimension",
          label: { "fa-IR": "استخر/سانس", "en-US": "Pool / Session" },
          synonyms: ["استخر", "سانس", "pool"] },
        { id: "Status", column: "Status", type: "number", role: "dimension",
          label: { "fa-IR": "وضعیت رزرو", "en-US": "Reservation Status" },
          synonyms: ["وضعیت", "پرداخت‌شده", "لغو", "در انتظار پرداخت"] },
        { id: "ReshteCode", column: "ReshteCode", type: "string", role: "dimension",
          label: { "fa-IR": "رشته", "en-US": "Field" },
          synonyms: ["رشته", "معماری", "عمران", "برق", "مکانیک"] },
        { id: "FullName", column: "FullName", type: "string", role: "dimension",
          label: { "fa-IR": "نام رزروکننده", "en-US": "Reserved By" },
          synonyms: ["نام", "مهندس", "رزروکننده"] },
        { id: "DateJalali", column: "DateJalali", type: "string", role: "dimension",
          label: { "fa-IR": "تاریخ رزرو (شمسی)", "en-US": "Reserved Date (Jalali)" },
          synonyms: ["تاریخ شمسی", "روز"] },
        { id: "Date", column: "Date", type: "date", role: "date",
          label: { "fa-IR": "تاریخ رزرو", "en-US": "Reserved Date" },
          synonyms: ["تاریخ", "روز", "date"] },
        { id: "Created", column: "Created", type: "date", role: "date",
          label: { "fa-IR": "زمان ثبت", "en-US": "Created" },
          synonyms: ["ثبت", "زمان ثبت"] },
        { id: "AmountRials", column: "AmountRials", type: "number", role: "measure",
          label: { "fa-IR": "مبلغ (ریال)", "en-US": "Amount (Rials)" },
          synonyms: ["مبلغ", "ریال", "درآمد", "amount"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
      ],
    },
  ],
};

export const walfarePaymentsModel: SemanticModel = {
  id: "model-walfare-payments",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "پرداخت‌های سامانه رفاهی", "en-US": "Welfare Payments" },
  entities: [
    {
      id: "walfare_payments",
      source: "walfare_payments",
      name: { "fa-IR": "تراکنش", "en-US": "Transaction" },
      description: {
        "fa-IR": "تراکنش‌های درگاه پرداخت خدمات رفاهی: موفق، ناموفق و در انتظار",
        "en-US": "Welfare payment gateway transactions: succeeded, failed, pending",
      },
      fields: [
        { id: "Status", column: "Status", type: "number", role: "dimension",
          label: { "fa-IR": "وضعیت پرداخت", "en-US": "Payment Status" },
          synonyms: ["موفق", "ناموفق", "وضعیت پرداخت"] },
        { id: "Gateway", column: "Gateway", type: "number", role: "dimension",
          label: { "fa-IR": "درگاه", "en-US": "Gateway" },
          synonyms: ["درگاه", "ایران کیش", "gateway"] },
        { id: "TargetType", column: "TargetType", type: "string", role: "dimension",
          label: { "fa-IR": "نوع خدمت", "en-US": "Service Type" },
          synonyms: ["خدمت", "بابت"] },
        { id: "PayerName", column: "PayerName", type: "string", role: "dimension",
          label: { "fa-IR": "نام پرداخت‌کننده", "en-US": "Payer" },
          synonyms: ["پرداخت‌کننده", "نام"] },
        { id: "Created", column: "Created", type: "date", role: "date",
          label: { "fa-IR": "زمان تراکنش", "en-US": "Created" },
          synonyms: ["تاریخ", "زمان", "ماه"] },
        { id: "VerifiedAt", column: "VerifiedAt", type: "date", role: "date",
          label: { "fa-IR": "زمان تأیید", "en-US": "Verified At" },
          synonyms: ["تأیید", "verify"] },
        { id: "AmountRials", column: "AmountRials", type: "number", role: "measure",
          label: { "fa-IR": "مبلغ (ریال)", "en-US": "Amount (Rials)" },
          synonyms: ["مبلغ", "ریال", "درآمد", "amount"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
      ],
    },
  ],
};

export const walfarePoolsModel: SemanticModel = {
  id: "model-walfare-pools",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "استخرها و سانس‌های رفاهی", "en-US": "Welfare Pools" },
  entities: [
    {
      id: "walfare_pools",
      source: "walfare_pools",
      name: { "fa-IR": "سانس", "en-US": "Pool" },
      description: {
        "fa-IR": "سانس‌های تعریف‌شده خدمات رفاهی به همراه ظرفیت و قیمت",
        "en-US": "Configured welfare sessions with capacity and price",
      },
      fields: [
        { id: "Name", column: "Name", type: "string", role: "dimension",
          label: { "fa-IR": "نام سانس", "en-US": "Session Name" },
          synonyms: ["سانس", "استخر", "نام"] },
        { id: "ServiceId", column: "ServiceId", type: "number", role: "dimension",
          label: { "fa-IR": "خدمت", "en-US": "Service" },
          synonyms: ["خدمت", "service"] },
        { id: "IsActive", column: "IsActive", type: "number", role: "dimension",
          label: { "fa-IR": "فعال", "en-US": "Active" },
          synonyms: ["فعال", "غیرفعال"] },
        { id: "ReserveStartTime", column: "ReserveStartTime", type: "string", role: "dimension",
          label: { "fa-IR": "ساعت شروع", "en-US": "Start Time" },
          synonyms: ["ساعت", "شروع"] },
        { id: "Capacity", column: "Capacity", type: "number", role: "measure",
          label: { "fa-IR": "ظرفیت", "en-US": "Capacity" },
          synonyms: ["ظرفیت", "capacity"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
        { id: "PriceRials", column: "PriceRials", type: "number", role: "measure",
          label: { "fa-IR": "قیمت (ریال)", "en-US": "Price (Rials)" },
          synonyms: ["قیمت", "ریال", "price"],
          defaultAggregation: "avg", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
      ],
    },
  ],
};
