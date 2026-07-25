import type { SemanticModel } from "../../contracts/semantic";

export const salesModel: SemanticModel = {
  id: "model-sales",
  tenantId: "global",
  version: 1,
  defaultLocale: "fa-IR",
  name: { "fa-IR": "فروش", "en-US": "Sales" },
  entities: [
    {
      id: "sales",
      source: "sales",
      name: { "fa-IR": "سفارش فروش", "en-US": "Sales Order" },
      description: { "fa-IR": "سفارش‌های فروش", "en-US": "Sales orders" },
      defaultDateField: "orderDate",
      relationships: [
        { id: "sales_to_project_province", targetEntity: "project", localField: "province",
          targetField: "province", cardinality: "many-to-one",
          label: { "fa-IR": "استان پروژه", "en-US": "Project province" } },
      ],
      fields: [
        { id: "orderId", column: "orderId", type: "string", role: "dimension", hidden: true,
          label: { "fa-IR": "شماره سفارش", "en-US": "Order ID" },
          defaultAggregation: "countDistinct", allowedAggregations: ["count", "countDistinct"] },
        { id: "customerName", column: "customerName", type: "string", role: "dimension",
          label: { "fa-IR": "مشتری", "en-US": "Customer" }, synonyms: ["نام مشتری", "customer"] },
        { id: "product", column: "product", type: "string", role: "dimension",
          label: { "fa-IR": "محصول", "en-US": "Product" }, synonyms: ["کالا", "item"] },
        { id: "category", column: "category", type: "string", role: "dimension",
          label: { "fa-IR": "دسته‌بندی", "en-US": "Category" }, synonyms: ["گروه کالا"] },
        { id: "province", column: "province", type: "string", role: "dimension",
          label: { "fa-IR": "استان", "en-US": "Province" }, synonyms: ["منطقه", "region"] },
        { id: "channel", column: "channel", type: "string", role: "dimension",
          label: { "fa-IR": "کانال فروش", "en-US": "Channel" }, synonyms: ["آنلاین", "حضوری"] },
        { id: "status", column: "status", type: "string", role: "dimension",
          label: { "fa-IR": "وضعیت", "en-US": "Status" }, synonyms: ["مرحله", "state"] },
        { id: "quantity", column: "qty", type: "number", role: "measure",
          label: { "fa-IR": "تعداد", "en-US": "Quantity" }, synonyms: ["مقدار"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "number", decimals: 0, grouping: true } },
        // Reconciliation note: §6.3 names this measure `revenue`; §5.8/§5.9 reference it as
        // `amount`. We use a single canonical id `amount` (label "Revenue", synonyms include
        // `revenue`) so both the §5 worked-example definitions and the AI prompt-mapping
        // resolve to the same field.
        { id: "amount", column: "amount", type: "number", role: "measure",
          label: { "fa-IR": "درآمد", "en-US": "Revenue" },
          synonyms: ["فروش", "مبلغ", "درآمد کل", "sales", "amount", "revenue"],
          defaultAggregation: "sum", allowedAggregations: ["sum", "avg", "min", "max"],
          format: { kind: "currency", currency: "IRR", decimals: 0, grouping: true } },
        { id: "orderDate", column: "orderDate", type: "date", role: "date",
          label: { "fa-IR": "تاریخ سفارش", "en-US": "Order Date" },
          synonyms: ["ماه", "سال", "زمان", "monthly"], format: { kind: "date", pattern: "yyyy/MM" } },
      ],
    },
  ],
};
