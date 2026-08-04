# MunSanandaj: sixty failed runs that left no evidence, and the expired certificate behind them

**Date:** 2026-08-04
**Area:** mun-sanandaj (api worker)
**Status:** code fix shipped and verified live — **the underlying cause is an expired TLS certificate we do not control**

## Reported

Manual trigger of `SaveEngineerReport` returned 200 but `"status": "Failed"`, with
`totalRows: 1, successCount: 0, failedCount: 0`. The row existed — `WebS_GetListRepToShahrdari`
returned Peygiri `90043205090804023803` — but never appeared in «روند اجراها», and the 12-hour
schedule looked dead.

## Root cause

**The TLS certificate on `eservice.kurdnezam.ir` expired.**

```
subject = CN = eservice.kurdnezam.ir
issuer  = Certum Domain Validation CA SHA2
notAfter= Jul 21 10:38:17 2026 GMT      <- expired
today   = Aug  4 07:09:33 2026 GMT      <- 14 days later
```

`MunSanandajPdfFetcher` downloads the report PDF from
`https://eservice.kurdnezam.ir/sm/pdf/{peygiri}.pdf`. The handshake now fails:

```
HttpRequestException: The SSL connection could not be established
 -> AuthenticationException: the remote certificate is invalid because of errors
    in the certificate chain: NotTimeValid
```

Nothing in this repo is broken. **This is fixed by renewing the certificate on that host**, and by
nothing else. Certificate validation was deliberately NOT disabled — that would swap a visible
outage for a silent man-in-the-middle exposure on a channel carrying engineers' documents.

## Why it was invisible — the actual bug on our side

`RunAsync` called `processRow` **outside** any per-row try/catch. A row that *returned* `Failed`
was logged normally; a row that *threw* propagated to the run-level catch, which set
`Status = Failed` and stopped. Because the throw happened before `run.FailedCount++` and before the
`MunReportLogs.Add(...)`, the result was:

- `TotalRows = 1, SuccessCount = 0, FailedCount = 0` — the counters cannot even agree with each other
- **no log row at all**, so the dashboard showed a failed run containing nothing
- the reason existed only in the container log

The database shows exactly this. The last `mun_report_logs` row was written **2026-07-21 06:54:49**,
about 3¾ hours before the certificate expired. Every run since is `Failed / 1 / 0 / 0`:

| | value |
| --- | --- |
| runs total | 110 (50 Completed, 60 Failed) |
| runs that ever succeeded a row | **2**, both on 2026-07-04 |
| log rows | 50, none between 21 Jul and 4 Aug |

Before 21 Jul the same job was failing too — 38 attempts on Peygiri `90038565090621073109` with
`"pdf not found"` — but that was a *returned* failure, so it was visible the whole time. The
contrast is the whole point: returned failures were fine, thrown failures erased themselves.

## The fix

`processRow` is now wrapped per row. A throwing row becomes an ordinary `Failed` result, is written
to `mun_report_logs` with its reason, increments `FailedCount`, and the run continues to the next
row. New `Describe(ex)` flattens the exception chain — the outer message here is the useless "see
inner exception", and the operator needs the inner one — and truncates to the 1000-char column.

## Verified live

Triggered on production after deploying:

| | Run row | Log row |
| --- | --- | --- |
| before | `Failed`, rows=1 ok=0 **fail=0** | none |
| after | `Completed`, rows=1 ok=0 **fail=1** | `HttpRequestException: … -> AuthenticationException: the remote certificate is invalid …` |

`mun_report_logs` went 50 → 51, closing the 14-day gap. 9/9 tests pass in
`MunSanandajSyncServiceTests` (6 existing + 3 new for `Describe`).

## Corrections to the report

- **The 12-hour timer works.** `SaveEngineerReportWorker` is a `do { } while (WaitForNextTickAsync)`,
  so it runs at startup and every `MunSanandaj:IntervalHours`. The history shows
  `2026-08-03 05:37:36` → `2026-08-03 17:37:36`, exactly 12 hours apart, `TriggeredBy = Timer`. The
  extra runs are container restarts, which each fire one immediately. It looked dead because every
  run failed and left nothing behind.
- **`ReqId = NULL` is harmless.** `MunSanandajSourceReader` reads it as `reader["ReqId"].ToString()`,
  and `DBNull.ToString()` is `""` — not null, no exception. It was never the cause. Whether the
  municipality accepts an empty `reqId` is a separate question that cannot be answered until the
  certificate is renewed and a row actually reaches them.

## Left to do

- **Renew the certificate on `eservice.kurdnezam.ir`.** Until then every run will keep failing —
  now visibly, with the reason on screen.
- Once renewed, re-trigger and confirm the row either succeeds or fails for a real business reason.
- Consider an `ErrorMessage` column on `mun_sync_runs`: a failure *before* the row loop (e.g. the
  stored procedure itself failing) still leaves a bare "Failed" with no text. Needs a migration, so
  not done here.
