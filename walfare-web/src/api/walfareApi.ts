import { api, qs, WALFARE_PREFIX } from "./client";

const P = WALFARE_PREFIX;

// ── types (mirror src/Application/Walfare DTOs) ──────────────────────────────

/** WelfareServiceType on the API. */
export type WelfareServiceType = 1; // PoolTicket

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
};
