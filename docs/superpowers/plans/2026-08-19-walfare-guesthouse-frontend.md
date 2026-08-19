# مهمانسرا Guesthouse — Front-End Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to do this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the screens for the guesthouse service in `walfare-web`. The API is done and live.

**How it works:** A member asks for a stay. An admin says yes and types the price. A link goes to the member's phone by SMS. The member pays. The office prints a letter for the guesthouse manager.

**Tech:** React 19, Vite, Ant Design 5, TanStack Query, react-router. All text on screen is Persian, right to left.

**Spec:** [`docs/superpowers/specs/2026-08-19-walfare-guesthouse-design.md`](../specs/2026-08-19-walfare-guesthouse-design.md)
**Backend plan (done):** [`2026-08-19-walfare-guesthouse-backend.md`](2026-08-19-walfare-guesthouse-backend.md)

## Rules for every task

- **Write like the files next to you.** `walfare-web` already has pool booking screens. Copy their shape.
- **Enum values are numbers, not words.** The API sends `status: 1`, never `"Priced"`. If you type an enum as a string union, it builds fine and is wrong at run time, because every compare is just false.
- **All user text is Persian.** No English on screen.
- **Every page must work on a phone at 375px wide.** Check each page and each part of it: tables, inputs, cards, dialogs.
- **Money is Rials in the API.** Show Tomans on screen (Rials ÷ 10). Never send Tomans to the API.
- **Run `npm run build` and `npm run lint` in `walfare-web` before every commit.** Both must be clean.
- **Do not put a national code, a membership number, or a companion name on the public payment page.** The API leaves them out on purpose. Do not add them back.

## Where things go

| What | Where |
|---|---|
| Types + API calls | `src/api/walfareApi.ts` (add to the file that is there) |
| Query keys | `src/query/keys.ts` (add to the object that is there) |
| Member pages | `src/pages/` |
| Admin pages | `src/pages/admin/` |
| Routes | `src/app/router.tsx` |
| Jalali date input | `src/components/ui/JalaliFields.tsx` (already there) |

## The API you are calling

```
# member
GET    /api/walfare/guesthouses?serviceId=            list of open guesthouses
POST   /api/walfare/guesthouse-requests               send a request
GET    /api/walfare/guesthouse-requests/me            my requests

# anyone, no login
GET    /api/walfare/guesthouse/pay/{token}            what am I paying for
POST   /api/walfare/guesthouse/pay/{token}/init       start the payment

# admin
GET    /api/walfare/guesthouses/admin                 all guesthouses
POST   /api/walfare/guesthouses                       add one
PUT    /api/walfare/guesthouses/{id}                  edit one
DELETE /api/walfare/guesthouses/{id}                  remove one
POST   /api/walfare/guesthouse-requests/admin         make a request for someone else
GET    /api/walfare/guesthouse-requests/admin/list    all requests (paged)
POST   /api/walfare/guesthouse-requests/{id}/price    say yes + set the price
POST   /api/walfare/guesthouse-requests/{id}/reject   say no
POST   /api/walfare/guesthouse-requests/{id}/send-payment-sms
GET    /api/walfare/guesthouse-requests/{id}/referral  data for the letter
PUT    /api/walfare/guesthouse-requests/{id}/receipt   fix the receipt number
```

---

### Task 1: Types, API calls, and query keys

**Files:**
- Modify: `src/api/walfareApi.ts`
- Modify: `src/query/keys.ts`

**Gives the later tasks:** `GuesthouseRequestStatus`, `Guesthouse`, `GuesthouseInput`, `GuesthouseRequest`, `CompanionInput`, `GuesthousePaySummary`, `GuesthouseReferral`, and all the `walfareApi.*` calls below.

- [ ] **Step 1: Add the types**

At the top of `src/api/walfareApi.ts`, next to the other types. Note that `WelfareServiceType` there says `= 1`. Change it to `1 | 2` and add a comment that `2` is the guesthouse.

```ts
/** Numbers on the wire. Never a string union — the API sends 0..4. */
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

/** نسبت. Same numbers as the API. */
export const CompanionRelation = {
  Spouse: 0, Child: 1, Father: 2, Mother: 3, Brother: 4, Sister: 5, Other: 6,
} as const;
export type CompanionRelation = (typeof CompanionRelation)[keyof typeof CompanionRelation];

export const COMPANION_RELATION_LABELS: Record<CompanionRelation, string> = {
  0: "همسر", 1: "فرزند", 2: "پدر", 3: "مادر", 4: "برادر", 5: "خواهر", 6: "سایر",
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
  managerName: string;
  description: string;
  isActive: boolean;
}

export interface GuesthouseInput {
  serviceId: number;
  name: string;
  city: string;
  managerName: string;
  description: string;
  isActive: boolean;
}

export interface CompanionInput {
  fullName: string;
  /** null for a child under two. */
  relation: CompanionRelation | null;
  isInfant: boolean;
}

export interface GuesthouseRequestInput {
  guesthouseId: number;
  fullName: string;
  nationalCode: string;
  membershipNumber: string;
  mobile: string;
  /** Jalali as typed, e.g. 1405/06/01 */
  checkInDate: string;
  checkOutDate: string;
  companions: CompanionInput[];
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
  amountRials: number;
  adminNote: string;
  status: GuesthouseRequestStatus;
  receiptNumber: string;
  createdByAdmin: boolean;
  /** Only comes back for the owner or an admin. */
  paymentToken: string | null;
  paidAtUtc: string | null;
  companions: { fullName: string; relation: CompanionRelation | null; isInfant: boolean }[];
}

/**
 * What the public payment page shows.
 * On purpose there is no name, no national code, no membership number, and no
 * companion names. Anyone can forward that SMS. Do not add fields here.
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
  /** Persian reason when payable is false. Empty when true. */
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
  companions: { fullName: string; relation: CompanionRelation | null; isInfant: boolean }[];
}
```

- [ ] **Step 2: Add the API calls**

Inside the `walfareApi` object. Put the member calls after `myReservations`, and the admin calls at the end. `P` is `/api/walfare` and `qs()` builds the query string — both are already in this file.

```ts
  // guesthouse — member
  activeGuesthouses: (serviceId: number): Promise<Guesthouse[]> =>
    api.get(`${P}/guesthouses${qs({ serviceId })}`),
  createGuesthouseRequest: (input: GuesthouseRequestInput): Promise<number> =>
    api.post(`${P}/guesthouse-requests`, input),
  myGuesthouseRequests: (): Promise<GuesthouseRequest[]> =>
    api.get(`${P}/guesthouse-requests/me`),

  // guesthouse — public payment page, no login
  guesthousePaySummary: (token: string): Promise<GuesthousePaySummary> =>
    api.get(`${P}/guesthouse/pay/${encodeURIComponent(token)}`),
  initGuesthousePayment: (
    token: string,
  ): Promise<{ transactionId: number; redirectUrl: string }> =>
    api.post(`${P}/guesthouse/pay/${encodeURIComponent(token)}/init`, {}),

  // guesthouse — admin
  adminGuesthouses: (): Promise<Guesthouse[]> => api.get(`${P}/guesthouses/admin`),
  createGuesthouse: (input: GuesthouseInput): Promise<number> =>
    api.post(`${P}/guesthouses`, input),
  updateGuesthouse: (id: number, input: GuesthouseInput): Promise<void> =>
    api.put(`${P}/guesthouses/${id}`, input),
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
  priceGuesthouseRequest: (
    id: number,
    body: { amountRials: number; adminNote: string; gender: ApplicantGender | null },
  ): Promise<void> => api.post(`${P}/guesthouse-requests/${id}/price`, body),
  rejectGuesthouseRequest: (id: number, reason: string): Promise<void> =>
    api.post(`${P}/guesthouse-requests/${id}/reject`, { reason }),
  sendGuesthousePaymentSms: (id: number): Promise<void> =>
    api.post(`${P}/guesthouse-requests/${id}/send-payment-sms`, {}),
  guesthouseReferral: (id: number): Promise<GuesthouseReferral> =>
    api.get(`${P}/guesthouse-requests/${id}/referral`),
  updateGuesthouseReceipt: (id: number, receiptNumber: string): Promise<void> =>
    api.put(`${P}/guesthouse-requests/${id}/receipt`, { receiptNumber }),
```

- [ ] **Step 3: Add the query keys**

In `src/query/keys.ts`, inside the `queryKeys` object:

```ts
  guesthouses: {
    all: () => ["guesthouses"] as const,
    active: (serviceId: number) => ["guesthouses", "active", serviceId] as const,
    admin: () => ["guesthouses", "admin"] as const,
  },
  guesthouseRequests: {
    all: () => ["guesthouse-requests"] as const,
    mine: () => ["guesthouse-requests", "mine"] as const,
    admin: (params: object) => ["guesthouse-requests", "admin", params] as const,
    referral: (id: number) => ["guesthouse-requests", "referral", id] as const,
    paySummary: (token: string) => ["guesthouse-pay", token] as const,
  },
```

- [ ] **Step 4: Build and commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src/api/walfareApi.ts walfare-web/src/query/keys.ts
git commit -m "feat(walfare-web): types and API calls for the guesthouse service"
```

---

### Task 2: The member asks for a stay

**Files:**
- Modify: `src/pages/ServicesPage.tsx`
- Create: `src/pages/GuesthouseRequestPage.tsx`
- Modify: `src/app/router.tsx`

**Uses from Task 1:** `walfareApi.activeGuesthouses`, `walfareApi.createGuesthouseRequest`, `GuesthouseRequestInput`, `CompanionInput`, `COMPANION_RELATION_LABELS`.

- [ ] **Step 1: Show the guesthouse on the services page**

`ServicesPage.tsx` lists services and goes to `/book/{id}` when one is clicked. A service now has `type` 1 (pool) or 2 (guesthouse). Send type 2 to a new route:

```tsx
onClick={() => navigate(s.type === 2 ? `/guesthouse/${s.id}` : `/book/${s.id}`)}
```

Also make a `GuesthouseBadge` next to the `PoolBadge` that is already there, and pick the badge by `s.type`. Read `PoolBadge` first and copy its shape.

- [ ] **Step 2: Build the request page**

Create `src/pages/GuesthouseRequestPage.tsx`. It reads `serviceId` from the route. It shows:

1. A picker for the guesthouse — `walfareApi.activeGuesthouses(serviceId)`, showing «شهر — نام».
2. The person's own name, national code, membership number, and mobile. Fill these from `walfareApi.me()` (the `useApiQuery` for `queryKeys.me.get()` is already there) but leave every box editable.
3. Two Jalali dates: «تاریخ ورود» and «تاریخ خروج». Use `JalaliDateField` from `src/components/ui/JalaliFields.tsx`.
4. A companion list, `Form.List`, up to **5** rows: name + a نسبت picker from `COMPANION_RELATION_LABELS`.
5. A child list, `Form.List`, up to **2** rows: name only. These are sent as `isInfant: true` and `relation: null`.
6. A submit button, «ثبت درخواست».

Turn the two lists into one array before you send:

```ts
const companions: CompanionInput[] = [
  ...(values.companions ?? []).map((c) => ({
    fullName: c.fullName, relation: c.relation ?? null, isInfant: false,
  })),
  ...(values.infants ?? []).map((c) => ({
    fullName: c.fullName, relation: null, isInfant: true,
  })),
];
```

The API checks the limits too and answers in Persian, so show its message on the field when it says no. `ApiError.problem.errors` already carries per-field messages — see how `FormDrawer` uses them.

After a good save, show «درخواست شما ثبت شد» and go to the my-requests page.

- [ ] **Step 3: Add the route**

In `src/app/router.tsx`, inside the signed-in group next to `/book/:serviceId`:

```tsx
{ path: "/guesthouse/:serviceId", element: <GuesthouseRequestPage /> },
```

- [ ] **Step 4: Check it on a phone, build, commit**

Open it at 375px wide. The date boxes and the companion rows must not run off the side.

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): a member can ask for a guesthouse stay"
```

---

### Task 3: The member sees the request and pays

**Files:**
- Modify: `src/pages/MyReservationsPage.tsx`

- [ ] **Step 1: Add a second tab**

`MyReservationsPage.tsx` shows pool bookings. Put it in an antd `Tabs` with two tabs: «استخر» and «مهمانسرا». The guesthouse tab reads `walfareApi.myGuesthouseRequests()` with key `queryKeys.guesthouseRequests.mine()`.

- [ ] **Step 2: One card per request**

Each card shows the guesthouse name and city, both dates, `nights` («۲ شب»), `guestCount` («۲ نفر»), and a status tag from `GUESTHOUSE_STATUS_LABELS`.

Colour the tag by status: `1` (منتظر پرداخت) orange, `2` (پرداخت شده) green, `3` (رد شده) red, `0` and `4` plain.

When `status` is `3`, show `adminNote` — that is the reason the office gave.

- [ ] **Step 3: The pay button**

Show a «پرداخت» button **only** when `status === 1` **and** `paymentToken` is not null. It opens the same page the SMS link opens:

```tsx
navigate(`/pay/guesthouse/${request.paymentToken}`);
```

Show the price as Tomans above it: `amountRials / 10`, grouped, Persian digits. `src/lib/format.ts` already has helpers — read it and use them.

- [ ] **Step 4: Build, check the phone, commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): the member sees guesthouse requests and can pay"
```

---

### Task 4: The payment page (no login)

**Files:**
- Create: `src/pages/GuesthousePayPage.tsx`
- Modify: `src/app/router.tsx`

This is the page the SMS link opens. **The person may have no account at all.** That is the whole point.

- [ ] **Step 1: Put the route OUTSIDE the login guard**

In `src/app/router.tsx`, next to `/login` and `/auth/callback` — **not** inside `RequireAuth`:

```tsx
{ path: "/pay/guesthouse/:token", element: <GuesthousePayPage /> },
```

If you put it inside the guard, the person is sent to a login screen they can never pass, and the feature is dead.

- [ ] **Step 2: Build the page**

It reads `token` from the route and calls `walfareApi.guesthousePaySummary(token)`.

It shows: guesthouse name and city, the two dates, nights, guest count, and the price in Tomans.

- When `payable` is `true`: a big «پرداخت» button. On click, call `walfareApi.initGuesthousePayment(token)` and then `window.location.href = result.redirectUrl`.
- When `payable` is `false`: show `reason` and **no button**. The API blanks all the stay fields in this case, so the page shows only the reason. That is on purpose — a dead link must not keep telling people about someone's trip.
- When the call fails with 404 or 400: «این لینک پرداخت معتبر نیست».

Keep the page simple and on its own. No sidebar, no menu, no user chip — the person is not signed in.

- [ ] **Step 3: Do not add anything else to this page**

No name. No national code. No companion list. If a field feels missing, it was left out on purpose.

- [ ] **Step 4: Build, check the phone, commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): the public guesthouse payment page"
```

---

### Task 5: Admin — manage guesthouses

**Files:**
- Create: `src/pages/admin/AdminGuesthousesPage.tsx`
- Modify: `src/app/router.tsx`, and the admin menu (find it in `src/layout/`)

- [ ] **Step 1: Copy the pools page**

`src/pages/admin/AdminPoolsPage.tsx` does this same job for pools: a table, an add button, a drawer form, edit and delete. Read it and copy its shape.

Fields: name, city, manager name, description, and an on/off switch («فعال»).

Use the `useCrud` hook from `src/query/useCrud.ts` with `walfareApi.adminGuesthouses` / `createGuesthouse` / `updateGuesthouse` / `deleteGuesthouse`, the same way the pools page does.

- [ ] **Step 2: Say what delete really does**

The API does **not** delete a guesthouse that already has requests — it turns it off instead, so old letters keep pointing at the right place. Put that in the confirm text:
«اگر برای این مهمانسرا درخواستی ثبت شده باشد، حذف نمی‌شود و فقط غیرفعال می‌گردد.»

- [ ] **Step 3: Route and menu, build, commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): admin page for guesthouses"
```

---

### Task 6: Admin — the requests list

**Files:**
- Create: `src/pages/admin/AdminGuesthouseRequestsPage.tsx`
- Modify: `src/app/router.tsx`, and the admin menu

This is the main screen for the office. Read `src/pages/admin/AdminReservationsPage.tsx` first — it is the paged admin table you are copying.

- [ ] **Step 1: The table**

`walfareApi.adminGuesthouseRequests({ status, guesthouseId, page, pageSize })` with key `queryKeys.guesthouseRequests.admin(params)`. It returns `Paged<GuesthouseRequest>` — the same shape the reservations page already pages through.

Columns: person (name + national code), guesthouse (name + city), stay (both dates + «۲ شب»), guests, price, status, and buttons.

Filters on top: status and guesthouse.

The table needs `scroll={{ x: "max-content" }}` or it will be crushed on a phone.

- [ ] **Step 2: The «تأیید و تعیین مبلغ» dialog**

Only for `status` `0` or `1`. A small form:
- price in **Tomans** (this is what the admin thinks in)
- a note box
- «جناب آقای / سرکار خانم» — a radio, `ApplicantGender`

On save, turn Tomans into Rials:

```ts
await walfareApi.priceGuesthouseRequest(id, {
  amountRials: tomans * 10,
  adminNote,
  gender,
});
```

Two things to tell the admin in the dialog:
- «با تأیید، لینک پرداخت ساخته می‌شود.»
- «برای صدور معرفی‌نامه، «جناب آقای / سرکار خانم» باید مشخص باشد.» — because the letter will not print without it.

- [ ] **Step 3: The «رد کردن» dialog**

Only for `status` `0` or `1`. Asks for a reason, which is required. The member will read it. Then `walfareApi.rejectGuesthouseRequest(id, reason)`.

- [ ] **Step 4: The «ارسال پیامک پرداخت» button**

Only for `status === 1`. Calls `walfareApi.sendGuesthousePaymentSms(id)`.

Show the real answer, not a guess:
- ok → «پیامک ارسال شد»
- failed → show the Persian message the API sent back. **Do not** show a success toast when it failed. The API tells the truth about whether the SMS company took the message, and the admin needs that truth.

The button should show the mobile it will send to, so the admin can see it is right before pressing.

- [ ] **Step 5: The receipt number**

For `status === 2`, let the admin edit `receiptNumber` in place and call `walfareApi.updateGuesthouseReceipt(id, value)`.

Tell them what it does **not** do: «ویرایش شماره فیش، پرداخت را ثبت نمی‌کند.» It only fixes the number.

- [ ] **Step 6: Build, check the phone, commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): admin list for guesthouse requests"
```

---

### Task 7: The letter to print

**Files:**
- Create: `src/pages/admin/GuesthouseReferralPage.tsx`
- Modify: `src/app/router.tsx`

- [ ] **Step 1: The page**

Route `/admin/guesthouse-requests/:id/referral`, admin only. Reads `walfareApi.guesthouseReferral(id)`.

It draws the bottom half of the paper form:

> مسئول محترم مهمانسرای **{guesthouseName}**
>
> احتراماً {applicantTitle} **{fullName}** با مشخصات فوق با شماره فیش **{receiptNumber}** جهت هماهنگی‌های لازم بحضور معرفی می‌گردد.
>
> امور رفاهی

Also show the dates, the number of nights, and the guest count.

- [ ] **Step 2: Handle the two refusals**

The API says no in two cases, each with its own Persian message:
- the request is not paid yet
- «جناب آقای / سرکار خانم» is not set

Show that message and a way back. Do not show an empty letter.

- [ ] **Step 3: Print styles**

A «چاپ» button that calls `window.print()`. Add a print stylesheet so only the letter prints:

```css
@media print {
  .no-print { display: none !important; }
  body { background: #fff; }
}
```

Put `no-print` on the app chrome and the button. Leave blank space at the bottom for the stamp and the signature.

- [ ] **Step 4: Build, commit**

```bash
cd walfare-web && npm run build && npm run lint
git add walfare-web/src
git commit -m "feat(walfare-web): print the guesthouse referral letter"
```

---

### Task 8: Check everything, then put it on the server

- [ ] **Step 1: Check every screen on a phone**

375px wide, each page and each part:
- request form — the date boxes, the companion rows
- my requests — the cards
- payment page — the button must be easy to press
- admin table — must scroll sideways, not get crushed
- price dialog and reject dialog
- the letter

- [ ] **Step 2: Walk the whole flow by hand**

Sign in as an admin. Add a guesthouse. Make a request for a national code that is **not** in KurdNezam — this is the case the whole feature is for. Set a price. Send the SMS. Open the link on a phone. Pay. Print the letter.

Write down what worked and what did not.

- [ ] **Step 3: Put it on the server**

One service, the small way, not the whole stack:

```bash
tar -czf /tmp/walfare-web.tgz walfare-web/src
# copy it up, unpack it, then on the server:
docker compose -f deploy/docker-compose.newserver.yml --env-file deploy/.env build walfare-web
# read the result. A build that failed still lets the next line start the OLD image.
docker compose -f deploy/docker-compose.newserver.yml --env-file deploy/.env up -d --no-deps --force-recreate walfare-web
```

Check that the bundle name in `index.html` changed. A healthy container is not proof.

- [ ] **Step 4: Write the work record**

`docs/worklog/YYYY-MM-DD-walfare-guesthouse-frontend.md` from `docs/worklog/TEMPLATE.md`, and add a line to `docs/worklog/README.md`. Say plainly what you tested and what you did not.

---

## Things that will bite you

- **Enums are numbers.** `status: 1`. A string union builds fine and is wrong at run time.
- **The payment route must be outside the login guard.** Inside it, the feature is dead for anyone with no account.
- **Do not add fields to the payment page.** The API leaves out the name and the national code on purpose. That SMS can be forwarded to anyone.
- **Tomans on screen, Rials in the API.** Multiply by 10 on the way in.
- **The SMS can fail.** Show the real answer from the API, never a success message by default.
- **The letter needs the gender field.** If the admin never set it, the letter will not print. Say so in the price dialog, before they reach the letter.
