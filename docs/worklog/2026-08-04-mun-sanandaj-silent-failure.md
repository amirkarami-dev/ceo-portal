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

## Follow-up the same day: getting past the certificate

Asked to fall back to plain HTTP when TLS fails. **That cannot work** — measured, not assumed:

```
eservice.kurdnezam.ir -> 185.172.69.253
  port 443  OPEN
  port 80   connect timed out after 20 s
```

The same server reaches port 80 on `example.com`, `kurdnezam.ir` and `myceo.ir` fine, so it is that
host's firewall, not our egress. An `http://` fallback would only add 20 s to every failure.

What *is* true: the file is perfectly serviceable over HTTPS —
`curl -k` returns `200, 120091 bytes, application/pdf, %PDF-1.4`. The chain verifies at both CA
levels (`verify return:1`); the single error is `certificate has expired` at depth 0.

So instead of downgrading the transport, certificate validation was **narrowed**. A download is
accepted only when *all* of these hold:

1. the sole handshake complaint is a chain error,
2. every chain error is `NotTimeValid` — expiry and nothing else,
3. the certificate's SPKI SHA-256 equals a configured pin.

The pin is the safety: an attacker cannot complete a handshake with that certificate without its
private key, and a substituted certificate — even a currently-valid one from a real CA — has a
different key and is refused. A wrong host name, untrusted root or revoked certificate all still
fail. If the switch is on but the pin is missing, it logs an error and reverts to strict validation:
it never degrades to "accept anything".

```
MUN_SANANDAJ_ALLOW_EXPIRED_PDF_CERT=true
MUN_SANANDAJ_PDF_CERT_PIN=baf1e02d166994e600b84ca0a0ab91af81d7c439b41c692654ed0f9198832ad6
```

**Set the switch to false once the certificate is renewed.** Renewal changes the key, so the pin
stops matching and downloads fail closed rather than quietly staying on the weaker path.

Also this round:

- URL shortened to `/pdf/{peygiri}.pdf`. Verified both paths serve the identical file (same 120091
  bytes, same `%PDF-` magic); a missing report is a real 404 on both.
- Interval default 12 h → **2 h**, and exposed as `MUN_SANANDAJ_INTERVAL_HOURS` so it is tunable
  without a rebuild.

## What the certificate was hiding

With TLS working, the row finally reached the municipality — and was refused:

```
{"success":false,"msg":"melk_id is empty..."}
```

`MunSanandajGatewayClient` sends `melk_id={reqId}`, and `WebS_GetListRepToShahrdari` returns
`ReqId` as **NULL**, which the reader turns into `""`. So the NULL flagged in the original report
*was* a real blocker after all — just not the one causing the "Failed" status. It could not have
been diagnosed before, because nothing ever got far enough to be refused.

### Skipped, not failed

Readiness is now decided in `RunAsync` **immediately after the procedure returns**, before anything
is attempted. A row without `ReqId` is *skipped*: not counted in `TotalRows`, not sent, and **not
written as a Failed log row**.

That distinction is the point. A missing `ReqId` is not something we got wrong — it is source data
that is not finished. Treating it as a failure would append an identical Failed row every two hours
forever and make a data-entry gap look like a broken integration. Skipping it keeps the dashboard
honest: `Completed, rows=0` means "nothing was ready", which is true.

It is still **named**, every run, at Warning level — the lesson of this whole investigation is that
an invisible non-event is worse than a visible failure:

```
MunSanandaj SaveEngineerReport: skipped 1 of 1 row(s) that are not ready:
  90042743090804082619 (no ReqId — the municipality requires it as melk_id; set it in WebS_GetListRepToShahrdari)
```

**`saveEngMap` is deliberately not filtered** — it sends no `melk_id`, so a row without `ReqId` is
perfectly processable there, and filtering it would silently drop work. `RunSaveEngMapAsync` passes
`skipRow: null`, and a test exists purely as a tripwire against someone "tidying" that up.

Verified live: the run at 08:48:42 recorded `Completed, rows=0, ok=0, fail=0` with no new log row.
23/23 MunSanandaj tests pass.

## Left to do

- **Populate `ReqId` in `WebS_GetListRepToShahrdari`.** As of 2026-08-04 08:15 UTC the procedure on
  `185.10.73.114 / KurdNezam` still returns
  `90043205090804023803 | 90043205 | - | NULL`. Nothing can be submitted until it has a value.
- **Renew the certificate on `eservice.kurdnezam.ir`**, then set
  `MUN_SANANDAJ_ALLOW_EXPIRED_PDF_CERT=false`.
- Consider an `ErrorMessage` column on `mun_sync_runs`: a failure *before* the row loop (e.g. the
  stored procedure itself failing) still leaves a bare "Failed" with no text. Needs a migration, so
  not done here.
