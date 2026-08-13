import type { SemanticModel } from "../../contracts/semantic";

// Frontend mirror of the backend KurdNezam semantic models
// (src/Infrastructure/Analytics/Sql/KurdNezamSemanticModelStore.cs). Used in REAL mode
// (VITE_USE_MOCK_API="false") for the Ask-AI dataset picker + auto-viz role hints.
// The backend remains authoritative for AI grounding + SQL; ids/sources/fields MUST match it.
// `column` = field id (the backend resolves the real column via ResolvedColumn = id).

export const ozInfoModel: SemanticModel = {
  id: "model-oz-info",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "اعضا و پروانه‌ها", "en-US": "Members & Licenses" },
  entities: [
    {
      id: "oz_info",
      source: "oz_info",
      name: { "fa-IR": "عضو", "en-US": "Member" },
      description: {
        "fa-IR": "اطلاعات عضویت و پروانه مهندسان استان کردستان",
        "en-US": "KurdNezam membership & license info",
      },
      fields: [
        { id: "Ozviat", column: "Ozviat", type: "number", role: "dimension",
          label: { "fa-IR": "کد عضویت", "en-US": "Membership No" }, synonyms: ["عضویت", "کد عضو"] },
        { id: "PayeT", column: "PayeT", type: "number", role: "dimension",
          label: { "fa-IR": "پایه طراحی", "en-US": "Design Grade" },
          synonyms: ["پایه طراحی", "طراح", "design grade"] },
        { id: "PayeNez", column: "PayeNez", type: "number", role: "dimension",
          label: { "fa-IR": "پایه نظارت", "en-US": "Supervision Grade" },
          synonyms: ["پایه نظارت", "ناظر", "supervision"] },
        { id: "MaxPaye", column: "MaxPaye", type: "number", role: "dimension",
          label: { "fa-IR": "بالاترین پایه", "en-US": "Max Grade" }, synonyms: ["بالاترین پایه"] },
        { id: "IsHogh", column: "IsHogh", type: "number", role: "dimension",
          label: { "fa-IR": "حقیقی/حقوقی", "en-US": "Legal/Natural" },
          synonyms: ["حقوقی", "حقیقی"] },
        { id: "TypDftr", column: "TypDftr", type: "number", role: "dimension",
          label: { "fa-IR": "نوع شخصیت", "en-US": "Entity Type" },
          synonyms: ["دفتر", "مجری", "آزمایشگاه"] },
        { id: "ExpDate", column: "ExpDate", type: "string", role: "dimension",
          label: { "fa-IR": "اعتبار پروانه", "en-US": "License Expiry" },
          synonyms: ["اعتبار", "انقضا", "پروانه"] ,
          format: { kind: "date", pattern: "YYYY/MM/DD", locale: "fa-IR" } },
        { id: "RegInErja", column: "RegInErja", type: "number", role: "dimension",
          label: { "fa-IR": "ثبت‌نام در ارجاع", "en-US": "Referral Registered" },
          synonyms: ["ارجاع", "ثبت نام ارجاع"] },
        { id: "Reshte", column: "Reshte", type: "string", role: "dimension",
          label: { "fa-IR": "رشته", "en-US": "Field" },
          synonyms: ["رشته", "معماری", "عمران", "برق", "مکانیک"] },
        { id: "LastWorkDate", column: "LastWorkDate", type: "string", role: "dimension",
          label: { "fa-IR": "آخرین تخصیص", "en-US": "Last Assignment" },
          synonyms: ["آخرین کار", "تخصیص"] ,
          format: { kind: "date", pattern: "YYYY/MM/DD", locale: "fa-IR" } },
        { id: "ActiveInErja", column: "ActiveInErja", type: "number", role: "measure",
          label: { "fa-IR": "تعداد شرکت در ارجاع", "en-US": "Referral Participations" },
          synonyms: ["شرکت در ارجاع"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
      ],
    },
  ],
};

// Renamed 2026-08-13 from «کارکرد پروژه‌ای مهندسان». The id and the entity source are deliberately
// unchanged — saved reports and dashboard widgets point at those, not at the display name.
export const engineerProjectsModel: SemanticModel = {
  id: "model-engineer-projects",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "اطلاعات پروژه‌ای مهندسان", "en-US": "Engineer Project Info" },
  entities: [
    {
      id: "engineer_projects",
      source: "engineer_projects",
      name: { "fa-IR": "پروژه", "en-US": "Project" },
      description: {
        "fa-IR": "پروژه‌های مهندسان: نوع پروژه، صلاحیت مهندس، شهر و متراژ درگیر در ظرفیت",
        "en-US": "Engineer projects: type, engineer qualification, city and capacity-used area",
      },
      fields: [
        { id: "ProjectNo", column: "ProjectNo", type: "string", role: "dimension",
          label: { "fa-IR": "شماره پرونده", "en-US": "File No" }, synonyms: ["پرونده", "پروژه"] },
        { id: "Ozviat", column: "Ozviat", type: "number", role: "dimension",
          label: { "fa-IR": "کد عضویت", "en-US": "Membership No" }, synonyms: ["عضویت", "مهندس"] },
        { id: "TypEng", column: "TypEng", type: "number", role: "dimension",
          label: { "fa-IR": "صلاحیت مهندس", "en-US": "Engineer Qualification" },
          synonyms: ["صلاحیت", "طراح", "ناظر", "نوع خدمت"] },
        { id: "IsHogh", column: "IsHogh", type: "number", role: "dimension",
          label: { "fa-IR": "حقیقی/حقوقی", "en-US": "Legal/Natural" }, synonyms: ["حقوقی", "حقیقی"] },
        { id: "IsErja", column: "IsErja", type: "number", role: "dimension",
          label: { "fa-IR": "ارجاعی", "en-US": "Referred" }, synonyms: ["ارجاع", "ارجاعی"] },
        { id: "IsHal", column: "IsHal", type: "number", role: "dimension",
          label: { "fa-IR": "وضعیت جاری", "en-US": "In Progress" }, synonyms: ["در حال کار", "جاری"] },
        // `type` stays "string" — the warehouse column is nvarchar holding Jalali text, and the
        // engine compares it as text. `format.kind` is the display-and-input hint: it is what tells
        // the filter bar to offer a Persian calendar instead of a free-text box.
        { id: "RegDate", column: "RegDate", type: "string", role: "dimension",
          label: { "fa-IR": "تاریخ درج در ظرفیت", "en-US": "Capacity Entry Date" },
          synonyms: ["تاریخ", "سال", "date"],
          format: { kind: "date", pattern: "YYYY/MM/DD", locale: "fa-IR" } },
        { id: "TypProject", column: "TypProject", type: "number", role: "dimension",
          label: { "fa-IR": "نوع پروژه", "en-US": "Project Type" },
          synonyms: ["نوع", "عادی", "مسکن ملی", "بافت فرسوده", "صنعتی"] },
        { id: "CityId", column: "CityId", type: "number", role: "dimension",
          label: { "fa-IR": "شهر", "en-US": "City" }, synonyms: ["شهرستان", "city"] },
        { id: "HasPayan", column: "HasPayan", type: "number", role: "dimension",
          label: { "fa-IR": "پایان‌کار", "en-US": "Completion Cert" }, synonyms: ["پایان کار"] },
        { id: "ExitTyp", column: "ExitTyp", type: "number", role: "dimension",
          label: { "fa-IR": "نوع خروج", "en-US": "Exit Type" }, synonyms: ["خروج"] },
        { id: "IsAfza", column: "IsAfza", type: "number", role: "dimension",
          label: { "fa-IR": "توسعه بنا", "en-US": "Extension" },
          synonyms: ["توسعه بنا", "افزایش بنا", "عادی"] },
        { id: "Meter", column: "Meter", type: "number", role: "measure",
          label: { "fa-IR": "متراژ درگیر در ظرفیت", "en-US": "Capacity-Used Area" },
          synonyms: ["متراژ", "متر کار", "مترمربع", "ظرفیت", "area"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
        { id: "MeterFull", column: "MeterFull", type: "number", role: "measure",
          label: { "fa-IR": "متراژ کل پروژه", "en-US": "Total Project Area" },
          synonyms: ["متراژ کل"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
      ],
    },
  ],
};
