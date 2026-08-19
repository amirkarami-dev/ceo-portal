// Dev-only harness for the guesthouse request form (route: /dev/guesthouse/:serviceId).
// Lets the form and its phone layout be checked without the OIDC login; excluded from prod.
//
// Same idea as PickerHarness, one step further: this page reads three queries, so the harness
// seeds the shared cache with FAKE rows first. Nothing here ever calls the API, and every value
// is invented — no real person's کد ملی belongs in a dev fixture.
import { useRef } from "react";
import { useParams } from "react-router-dom";
import { GuesthouseRequestPage } from "@/pages/GuesthouseRequestPage";
import { queryClient } from "@/query/client";
import { queryKeys } from "@/query";
import type { Guesthouse, WalfareEngineer, WelfareService } from "@/api/walfareApi";

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

  return <GuesthouseRequestPage />;
}
