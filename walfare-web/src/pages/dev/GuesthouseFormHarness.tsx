// Dev-only harnesses for the guesthouse member screens:
//   /dev/guesthouse/:serviceId  -> the request form
//   /dev/guesthouse-requests    -> «رزروهای من», the مهمانسرا tab
//   /dev/guesthouse-pay/:token  -> the public payment page
//   /dev/admin-guesthouses      -> the admin CRUD page
//   /dev/admin-services         -> the services page, to prove نوع survives an edit
//        token "payable" shows the payable state, anything else shows a dead link
// Lets the form and its phone layout be checked without the OIDC login; excluded from prod.
//
// Same idea as PickerHarness, one step further: this page reads three queries, so the harness
// seeds the shared cache with FAKE rows first. Nothing here ever calls the API, and every value
// is invented — no real person's کد ملی belongs in a dev fixture.
import { useRef, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { GuesthouseRequestPage } from "@/pages/GuesthouseRequestPage";
import { MyReservationsPage } from "@/pages/MyReservationsPage";
import { GuesthousePayPage } from "@/pages/GuesthousePayPage";
import { AdminGuesthousesPage } from "@/pages/admin/AdminGuesthousesPage";
import { AdminServicesPage } from "@/pages/admin/AdminServicesPage";
import { queryClient } from "@/query/client";
import { queryKeys } from "@/query";
import type {
  Guesthouse,
  GuesthousePaySummary,
  GuesthouseRequest,
  WalfareEngineer,
  WelfareService,
} from "@/api/walfareApi";

/**
 * Mirrors AppLayout's <Content> box on a phone (margin 8, padding 12, overflowX auto).
 *
 * Without it a harness measures a LIE: these dev routes sit outside AppLayout, so antd's
 * `List grid` gutter — a real `margin: 0 -8px` on its row — has no padding to sit inside and
 * reads as 16px of page overflow that the signed-in app never has.
 */
function HarnessFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: 8, padding: 12, overflowX: "auto", minHeight: 280 }}>{children}</div>
  );
}

function seed(serviceId: number) {
  const me: WalfareEngineer = {
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    reshteCode: "",
    mobile: "09000000000",
  };
  const service: WelfareService = {
    id: serviceId,
    type: 2,
    title: "مهمانسرا — تابستان ۱۴۰۵",
    startDate: "1405/04/01",
    endDate: "1405/06/31",
    activationDate: "1405/03/25",
    isAccessible: true,
    poolCount: 0,
  };
  const guesthouses: Guesthouse[] = [
    {
      id: 1,
      serviceId,
      name: "مهمانسرای شماره یک",
      city: "سنندج",
      managerName: "مسئول آزمایشی",
      description: "",
      isActive: true,
    },
    {
      id: 2,
      serviceId,
      name: "مهمانسرای دریا با نامی نسبتاً بلند برای آزمودن شکستن خط",
      city: "بندرعباس",
      managerName: "مسئول آزمایشی",
      description: "",
      isActive: true,
    },
  ];

  queryClient.setQueryData(queryKeys.me.get(), me);
  queryClient.setQueryData(queryKeys.services.active(), [service]);
  queryClient.setQueryData(queryKeys.guesthouses.active(serviceId), guesthouses);
}

/**
 * One service of each kind, shared by both admin harnesses.
 *
 * The pool one earns its place: it is what proves the guesthouse page's service picker
 * filters it out, and that editing the مهمانسرا service does not flip it back to a pool.
 */
const SEED_SERVICES: WelfareService[] = [
      {
        id: 7,
        type: 1,
        title: "بلیط استخر — تابستان ۱۴۰۵",
        startDate: "1405/04/01",
        endDate: "1405/06/31",
        activationDate: "1405/03/25",
        isAccessible: true,
        poolCount: 3,
      },
      {
        id: 8,
        type: 2,
        title: "مهمانسرا — تابستان ۱۴۰۵",
        startDate: "1405/04/01",
        endDate: "1405/06/31",
        activationDate: "1405/03/25",
        isAccessible: true,
        poolCount: 0,
      },
];

export function GuesthouseFormHarness() {
  const { serviceId: param } = useParams<{ serviceId: string }>();
  const serviceId = Number(param ?? 1);

  // Seed DURING this render, before the child reads the cache. A ref keeps it to once per
  // mount; setQueryData is idempotent, so StrictMode's double render costs nothing.
  const seeded = useRef(false);
  if (!seeded.current) {
    seed(serviceId);
    seeded.current = true;
  }

  return (
    <HarnessFrame>
      <GuesthouseRequestPage />
    </HarnessFrame>
  );
}


// ── the member's own list ───────────────────────────────────────────────────

/** One row per status, so every branch of the card is on screen at once. */
const FAKE_REQUESTS: GuesthouseRequest[] = [
  {
    id: 1,
    guesthouseId: 1,
    guesthouseName: "مهمانسرای شماره یک",
    guesthouseCity: "سنندج",
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    membershipNumber: "",
    mobile: "09000000000",
    gender: null,
    checkInDateJalali: "1405/06/01",
    checkOutDateJalali: "1405/06/03",
    nights: 2,
    guestCount: 2,
    amountRials: 0,
    adminNote: "",
    status: 0, // Submitted — no price yet, so no pay button
    receiptNumber: "",
    createdByAdmin: false,
    paymentToken: null,
    paidAtUtc: null,
    companions: [],
  },
  {
    id: 2,
    guesthouseId: 2,
    guesthouseName: "مهمانسرای دریا با نامی نسبتاً بلند برای آزمودن شکستن خط",
    guesthouseCity: "بندرعباس",
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    membershipNumber: "",
    mobile: "09000000000",
    gender: null,
    checkInDateJalali: "1405/06/10",
    checkOutDateJalali: "1405/06/14",
    nights: 4,
    guestCount: 3,
    amountRials: 12_500_000,
    adminNote: "اتاق سه‌تخته در طبقه دوم.",
    status: 1, // Priced + token — the ONLY row that may show a pay button
    receiptNumber: "",
    createdByAdmin: false,
    paymentToken: "dev-token-not-a-real-one",
    paidAtUtc: null,
    companions: [],
  },
  {
    id: 3,
    guesthouseId: 1,
    guesthouseName: "مهمانسرای شماره یک",
    guesthouseCity: "سنندج",
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    membershipNumber: "",
    mobile: "09000000000",
    gender: null,
    checkInDateJalali: "1405/05/02",
    checkOutDateJalali: "1405/05/05",
    nights: 3,
    guestCount: 1,
    amountRials: 9_000_000,
    adminNote: "",
    // Priced but the token is gone. Proves the pay button needs BOTH, not either.
    status: 1,
    receiptNumber: "",
    createdByAdmin: false,
    paymentToken: null,
    paidAtUtc: null,
    companions: [],
  },
  {
    id: 4,
    guesthouseId: 1,
    guesthouseName: "مهمانسرای شماره یک",
    guesthouseCity: "سنندج",
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    membershipNumber: "",
    mobile: "09000000000",
    gender: 0,
    checkInDateJalali: "1405/04/01",
    checkOutDateJalali: "1405/04/03",
    nights: 2,
    guestCount: 2,
    amountRials: 8_000_000,
    adminNote: "",
    status: 2, // Paid
    receiptNumber: "123456789",
    createdByAdmin: false,
    paymentToken: null,
    paidAtUtc: "2026-07-01T09:00:00Z",
    companions: [],
  },
  {
    id: 5,
    guesthouseId: 2,
    guesthouseName: "مهمانسرای دریا",
    guesthouseCity: "بندرعباس",
    fullName: "کاربر آزمایشی",
    nationalCode: "0000000000",
    membershipNumber: "",
    mobile: "09000000000",
    gender: null,
    checkInDateJalali: "1405/03/01",
    checkOutDateJalali: "1405/03/04",
    nights: 3,
    guestCount: 5,
    adminNote: "در این بازه ظرفیت تکمیل است. لطفاً تاریخ دیگری انتخاب کنید.",
    amountRials: 0,
    status: 3, // Rejected — the reason must be readable
    receiptNumber: "",
    createdByAdmin: false,
    paymentToken: null,
    paidAtUtc: null,
    companions: [],
  },
];

export function MyGuesthouseRequestsHarness() {
  const seeded = useRef(false);
  if (!seeded.current) {
    // Empty pool list so the other tab renders its empty state instead of calling the API.
    queryClient.setQueryData(queryKeys.reservations.mine(), []);
    queryClient.setQueryData(queryKeys.guesthouseRequests.mine(), FAKE_REQUESTS);
    seeded.current = true;
  }
  return (
    <HarnessFrame>
      <MyReservationsPage />
    </HarnessFrame>
  );
}


// ── the public payment page ─────────────────────────────────────────────────

export function GuesthousePayHarness() {
  const { token = "" } = useParams<{ token: string }>();

  const seeded = useRef(false);
  if (!seeded.current) {
    const payable = token === "payable";
    // Note how the unpayable shape carries NO stay fields. That is the API's real behaviour:
    // a dead link must not keep telling a stranger where somebody is staying and when.
    const summary: GuesthousePaySummary = payable
      ? {
          guesthouseName: "مهمانسرای دریا با نامی نسبتاً بلند برای آزمودن شکستن خط",
          guesthouseCity: "بندرعباس",
          checkInDateJalali: "1405/06/10",
          checkOutDateJalali: "1405/06/14",
          nights: 4,
          guestCount: 3,
          amountRials: 12_500_000,
          payable: true,
          reason: "",
        }
      : {
          guesthouseName: "",
          guesthouseCity: "",
          checkInDateJalali: "",
          checkOutDateJalali: "",
          nights: 0,
          guestCount: 0,
          amountRials: 0,
          payable: false,
          reason: "این لینک پرداخت منقضی شده است. لطفاً با امور رفاهی تماس بگیرید.",
        };
    queryClient.setQueryData(queryKeys.guesthouseRequests.paySummary(token), summary);
    seeded.current = true;
  }

  // NO HarnessFrame here, deliberately. This page is standalone in production too — it renders
  // its own full-height shell precisely because it has no AppLayout around it.
  return <GuesthousePayPage />;
}


// ── the admin CRUD page ─────────────────────────────────────────────────────

export function AdminGuesthousesHarness() {
  const seeded = useRef(false);
  if (!seeded.current) {
    const services: WelfareService[] = SEED_SERVICES;
    const rows: Guesthouse[] = [
      {
        id: 1,
        serviceId: 8,
        name: "مهمانسرای شماره یک",
        city: "سنندج",
        managerName: "مسئول آزمایشی",
        description: "",
        isActive: true,
      },
      {
        id: 2,
        serviceId: 8,
        name: "مهمانسرای دریا با نامی نسبتاً بلند برای آزمودن شکستن خط",
        city: "بندرعباس",
        managerName: "",
        description: "",
        isActive: false,
      },
    ];
    queryClient.setQueryData(queryKeys.services.admin(), services);
    queryClient.setQueryData(queryKeys.guesthouses.admin(), rows);
    seeded.current = true;
  }

  return (
    <HarnessFrame>
      <AdminGuesthousesPage />
    </HarnessFrame>
  );
}


export function AdminServicesHarness() {
  const seeded = useRef(false);
  if (!seeded.current) {
    queryClient.setQueryData(queryKeys.services.admin(), SEED_SERVICES);
    seeded.current = true;
  }
  return (
    <HarnessFrame>
      <AdminServicesPage />
    </HarnessFrame>
  );
}
