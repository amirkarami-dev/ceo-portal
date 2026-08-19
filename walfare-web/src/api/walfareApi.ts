import { api, qs, WALFARE_PREFIX } from "./client";

const P = WALFARE_PREFIX;

// ── types (mirror src/Application/Walfare DTOs) ──────────────────────────────

/** WelfareServiceType on the API. 1 = pool ticket, 2 = guesthouse (مهمانسرا). */
export type WelfareServiceType = 1 | 2;

export interface WelfareService {
  id: number;
  type: WelfareServiceType;
  title: string;
  /** Jalali strings, exactly as typed by the admin. */
  startDate: string;
  endDate: string;
  activationDate: string;
  isAccessible: boolean;
  poolCount: number;
}

export interface WelfareServiceInput {
  type: WelfareServiceType;
  title: string;
  startDate: string;
  endDate: string;
  activationDate: string;
  isAccessible: boolean;
}

export interface WelfarePool {
  id: number;
  serviceId: number;
  name: string;
  /** Bitmask, bit 0 = شنبه … bit 6 = جمعه. */
  activeDays: number;
  description: string;
  isActive: boolean;
  priceRials: number;
  reserveStartTime: string;
  reserveEndTime: string;
  capacity: number;
}

export interface WelfarePoolInput {
  serviceId: number;
  name: string;
  activeDays: number;
  description: string;
  isActive: boolean;
  priceRials: number;
  reserveStartTime: string;
  reserveEndTime: string;
  capacity: number;
}

export interface PoolAvailability {
  id: number;
  name: string;
  description: string;
  priceRials: number;
  reserveStartTime: string;
  reserveEndTime: string;
  capacity: number;
  reserved: number;
  remaining: number;
}

/** Service window + the weekdays it runs on — what the booking calendar badges its days with. */
export interface ServiceCalendar {
  serviceId: number;
  title: string;
  startDate: string;
  endDate: string;
  isAccessible: boolean;
  /** Bitmask, bit 0 = شنبه … bit 6 = جمعه (union over active pools). */
  activeDays: number;
  poolCount: number;
  minPriceRials: number | null;
}

export interface WalfareEngineer {
  fullName: string;
  nationalCode: string;
  reshteCode: string;
  mobile?: string | null;
}

/** ReservationStatus on the API. */
export const ReservationStatus = {
  PendingPayment: 0,
  Paid: 1,
  Cancelled: 2,
} as const;
export type ReservationStatus = (typeof ReservationStatus)[keyof typeof ReservationStatus];

export interface Reservation {
  id: number;
  poolId: number;
  poolName: string;
  date: string;
  fullName: string;
  nationalCode: string;
  reshteCode: string;
  mobile: string;
  amountRials: number;
  status: ReservationStatus;
  trackingCode?: string | null;
  created: string;
}

/** PaymentStatus on the API. */
export const PaymentStatus = {
  Initiated: 0,
  Succeeded: 1,
  Failed: 2,
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export interface PaymentTransaction {
  id: number;
  gateway: number;
  amountRials: number;
  paymentId: string;
  status: PaymentStatus;
  targetType: string;
  targetId: number;
  payerName: string;
  payerNationalCode: string;
  maskedPan?: string | null;
  retrievalReferenceNumber?: string | null;
  systemTraceAuditNumber?: string | null;
  description?: string | null;
  created: string;
  verifiedAt?: string | null;
}

// ── guesthouse (مهمانسرا) ──────────────────────────────────────

/**
 * Numbers on the wire, never a string union.
 *
 * The API sends `status: 1`. There is no JsonStringEnumConverter, so a string union like
 * "Priced" builds fine and is wrong when it runs — every compare is just false and nothing
 * reports an error.
 */
export const GuesthouseRequestStatus = {
  Submitted: 0,
  Priced: 1,
  Paid: 2,
  Rejected: 3,
  Cancelled: 4,
} as const;
export type GuesthouseRequestStatus =
  (typeof GuesthouseRequestStatus)[keyof typeof GuesthouseRequestStatus];

/** «جناب آقای» / «سرکار خانم» on the letter. The office picks it, not the member. */
export const ApplicantGender = { Male: 0, Female: 1 } as const;
export type ApplicantGender = (typeof ApplicantGender)[keyof typeof ApplicantGender];

/** نسبت — the same numbers the API uses. */
export const CompanionRelation = {
  Spouse: 0,
  Child: 1,
  Father: 2,
  Mother: 3,
  Brother: 4,
  Sister: 5,
  Other: 6,
} as const;
export type CompanionRelation = (typeof CompanionRelation)[keyof typeof CompanionRelation];

export const COMPANION_RELATION_LABELS: Record<CompanionRelation, string> = {
  0: "همسر",
  1: "فرزند",
  2: "پدر",
  3: "مادر",
  4: "برادر",
  5: "خواهر",
  6: "سایر",
};

export const GUESTHOUSE_STATUS_LABELS: Record<GuesthouseRequestStatus, string> = {
  0: "در انتظار بررسی",
  1: "منتظر پرداخت",
  2: "پرداخت شده",
  3: "رد شده",
  4: "لغو شده",
};

export interface Guesthouse {
  id: number;
  serviceId: number;
  name: string;
  city: string;
  /** مسئول مهمانسرا — goes on the referral letter. */
  managerName: string;
  description: string;
  isActive: boolean;
}

export type GuesthouseInput = Omit<Guesthouse, "id">;

export interface GuesthouseCompanion {
  fullName: string;
  /** null for a child under two — that row has no نسبت on the paper form. */
  relation: CompanionRelation | null;
  isInfant: boolean;
}

export interface GuesthouseRequestInput {
  guesthouseId: number;
  fullName: string;
  nationalCode: string;
  membershipNumber: string;
  mobile: string;
  /** Jalali, as the user types it: 1405/06/01 */
  checkInDate: string;
  checkOutDate: string;
  companions: GuesthouseCompanion[];
}

export interface GuesthouseRequest {
  id: number;
  guesthouseId: number;
  guesthouseName: string;
  guesthouseCity: string;
  fullName: string;
  nationalCode: string;
  membershipNumber: string;
  mobile: string;
  gender: ApplicantGender | null;
  checkInDateJalali: string;
  checkOutDateJalali: string;
  nights: number;
  guestCount: number;
  /** Rials. Show Tomans on screen — divide by 10. */
  amountRials: number;
  adminNote: string;
  status: GuesthouseRequestStatus;
  receiptNumber: string;
  createdByAdmin: boolean;
  /** Only sent to the row's owner or to an admin. It opens the payment page. */
  paymentToken: string | null;
  paidAtUtc: string | null;
  companions: GuesthouseCompanion[];
}

/**
 * All the public payment page is allowed to show.
 *
 * There is no name, no national code, no membership number and no companion names, on
 * purpose. The link travels in an SMS and anyone can pass it on. Do not add fields — a
 * server test fails if the API adds one.
 */
export interface GuesthousePaySummary {
  guesthouseName: string;
  guesthouseCity: string;
  checkInDateJalali: string;
  checkOutDateJalali: string;
  nights: number;
  guestCount: number;
  amountRials: number;
  payable: boolean;
  /** Persian reason when `payable` is false. Empty when it is true. */
  reason: string;
}

export interface GuesthouseReferral {
  id: number;
  guesthouseName: string;
  guesthouseCity: string;
  managerName: string;
  /** Already built by the API: «جناب آقای مهندس» or «سرکار خانم مهندس». */
  applicantTitle: string;
  fullName: string;
  checkInDateJalali: string;
  checkOutDateJalali: string;
  nights: number;
  guestCount: number;
  receiptNumber: string;
  companions: GuesthouseCompanion[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── endpoints ────────────────────────────────────────────────────────────────

export const walfareApi = {
  // engineer
  me: (): Promise<WalfareEngineer> => api.get(`${P}/me`),
  activeServices: (): Promise<WelfareService[]> => api.get(`${P}/services`),
  poolsForDate: (serviceId: number, date: string): Promise<PoolAvailability[]> =>
    api.get(`${P}/pools/for-date${qs({ serviceId, date })}`),
  serviceCalendar: (serviceId: number): Promise<ServiceCalendar> =>
    api.get(`${P}/pools/calendar${qs({ serviceId })}`),
  createReservation: (poolId: number, date: string): Promise<number> =>
    api.post(`${P}/reservations`, { poolId, date }),
  myReservations: (): Promise<Reservation[]> => api.get(`${P}/reservations/me`),
  initPayment: (reservationId: number): Promise<{ transactionId: number; redirectUrl: string }> =>
    api.post(`${P}/payments/init`, { reservationId }),

  // admin
  adminServices: (): Promise<WelfareService[]> => api.get(`${P}/services/admin`),
  createService: (input: WelfareServiceInput): Promise<number> => api.post(`${P}/services`, input),
  updateService: (id: number, input: WelfareServiceInput): Promise<void> =>
    api.put(`${P}/services/${id}`, input),
  deleteService: (id: number): Promise<void> => api.del(`${P}/services/${id}`),

  adminPools: (serviceId?: number): Promise<WelfarePool[]> =>
    api.get(`${P}/pools/admin${qs({ serviceId })}`),
  createPool: (input: WelfarePoolInput): Promise<number> => api.post(`${P}/pools`, input),
  updatePool: (id: number, input: WelfarePoolInput): Promise<void> =>
    api.put(`${P}/pools/${id}`, input),
  deletePool: (id: number): Promise<void> => api.del(`${P}/pools/${id}`),

  adminReservations: (params: {
    poolId?: number;
    status?: ReservationStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paged<Reservation>> => api.get(`${P}/reservations/admin${qs(params)}`),

  adminPayments: (params: {
    status?: PaymentStatus;
    q?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Paged<PaymentTransaction>> => api.get(`${P}/payments/admin${qs(params)}`),

  /** Admin manual verify for a transaction the bank callback left unverified. */
  confirmPayment: (id: number): Promise<PaymentTransaction> =>
    api.post(`${P}/payments/${id}/confirm`),

  // ── guesthouse: member ───────────────────────────────────────────
  activeGuesthouses: (serviceId: number): Promise<Guesthouse[]> =>
    api.get(`${P}/guesthouses${qs({ serviceId })}`),
  createGuesthouseRequest: (input: GuesthouseRequestInput): Promise<number> =>
    api.post(`${P}/guesthouse-requests`, input),
  myGuesthouseRequests: (): Promise<GuesthouseRequest[]> =>
    api.get(`${P}/guesthouse-requests/me`),

  // ── guesthouse: the payment page, NO login ───────────────────────────
  // Whoever opens the SMS link may have no account at all. That is the point of the
  // feature, so these two must never be put behind the sign-in guard.
  guesthousePaySummary: (token: string): Promise<GuesthousePaySummary> =>
    api.get(`${P}/guesthouse/pay/${encodeURIComponent(token)}`),
  initGuesthousePayment: (
    token: string,
  ): Promise<{ transactionId: number; redirectUrl: string }> =>
    api.post(`${P}/guesthouse/pay/${encodeURIComponent(token)}/init`),

  // ── guesthouse: admin ────────────────────────────────────────────
  adminGuesthouses: (): Promise<Guesthouse[]> => api.get(`${P}/guesthouses/admin`),
  createGuesthouse: (input: GuesthouseInput): Promise<number> =>
    api.post(`${P}/guesthouses`, input),
  updateGuesthouse: (id: number, input: GuesthouseInput): Promise<void> =>
    api.put(`${P}/guesthouses/${id}`, input),
  /** Removes it, or just turns it off when requests already point at it. */
  deleteGuesthouse: (id: number): Promise<void> => api.del(`${P}/guesthouses/${id}`),

  createGuesthouseRequestAdmin: (input: GuesthouseRequestInput): Promise<number> =>
    api.post(`${P}/guesthouse-requests/admin`, input),
  adminGuesthouseRequests: (params: {
    status?: GuesthouseRequestStatus;
    guesthouseId?: number;
    page?: number;
    pageSize?: number;
  }): Promise<Paged<GuesthouseRequest>> =>
    api.get(`${P}/guesthouse-requests/admin/list${qs(params)}`),
  /** Says yes and sets the price. This is the step that makes the payment link exist. */
  priceGuesthouseRequest: (
    id: number,
    body: { amountRials: number; adminNote: string; gender: ApplicantGender | null },
  ): Promise<void> => api.post(`${P}/guesthouse-requests/${id}/price`, body),
  rejectGuesthouseRequest: (id: number, reason: string): Promise<void> =>
    api.post(`${P}/guesthouse-requests/${id}/reject`, { reason }),
  /** Throws with a Persian message when the SMS company did not take it. */
  sendGuesthousePaymentSms: (id: number): Promise<void> =>
    api.post(`${P}/guesthouse-requests/${id}/send-payment-sms`),
  guesthouseReferral: (id: number): Promise<GuesthouseReferral> =>
    api.get(`${P}/guesthouse-requests/${id}/referral`),
  /** Fixes شماره فیش only. It does NOT record a payment. */
  updateGuesthouseReceipt: (id: number, receiptNumber: string): Promise<void> =>
    api.put(`${P}/guesthouse-requests/${id}/receipt`, { receiptNumber }),
};
