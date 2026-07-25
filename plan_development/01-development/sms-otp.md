# SMS & OTP

> **Under central OIDC SSO (ADR-013) the OTP login now lives in the IdP (`src/Auth`), reached via the OIDC flow — NOT `/api/Auth/otp/*` on the resource API. This describes the OTP mechanism (SMS code request/verify), which is unchanged; only the host app moved.**

`<PLACEHOLDER>` supports passwordless mobile sign-in via a one-time SMS code (OTP). The OTP
lifecycle (generate, store, throttle, verify) lives in `OtpService`, and delivery is
abstracted behind `ISmsSender` with a relay / Kavenegar / log provider. Codes are stored in
`IDistributedCache` (not the database).

Endpoints: `POST /api/Auth/otp/request` and `POST /api/Auth/otp/verify` (the `Auth` endpoint
group; see `auth-and-roles.md` for how a successful verify issues a bearer token).

---

## 1. OTP service (`IOtpService` / `OtpService`)

Contract (`Application/Common/Interfaces/IOtpService.cs`):

```csharp
public interface IOtpService
{
    Task RequestAsync(string phoneNumber, CancellationToken ct = default);
    Task<bool> VerifyAsync(string phoneNumber, string code, CancellationToken ct = default);
}
```

`Infrastructure/Auth/OtpService.cs` implements it over `IDistributedCache` + `ISmsSender`.

### Storage in IDistributedCache (not the DB)
Codes and counters are short-lived, so they live in the distributed cache under namespaced
keys, each with its own TTL:

```csharp
private static string Key(string phone)          => $"otp:{phone}";            // the active code
private static string CooldownKey(string phone)  => $"otp:cooldown:{phone}";   // resend cooldown
private static string SendCountKey(string phone) => $"otp:sends:{phone}";      // hourly send cap
private static string AttemptsKey(string phone)  => $"otp:attempts:{phone}";   // failed verifies
```

The DI registration uses an in-memory distributed cache by default:

```csharp
services.AddDistributedMemoryCache();   // swap for AddStackExchangeRedisCache in multi-instance prod
```

> In-memory cache is per-process. If you run more than one API instance, replace it with a
> shared store (Redis) so a code issued by one instance verifies on another.

### Generate + send (`RequestAsync`)
1. **Resend cooldown** — if a code was issued very recently, silently no-op (prevents SMS
   spam/cost abuse).
2. **Hourly send cap** — if `sends >= MaxSendsPerHour`, throttle (log + return).
3. Generate a cryptographically-random numeric code of `CodeLength` digits and store it
   with `AbsoluteExpirationRelativeToNow = TtlSeconds`.
4. Reset the attempt counter, arm the cooldown, bump the hourly send count.
5. Send the SMS via `ISmsSender`.

```csharp
var code = GenerateCode(_options.CodeLength);   // RandomNumberGenerator, zero-padded
await _cache.SetStringAsync(Key(phone), code, new DistributedCacheEntryOptions {
    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.TtlSeconds) }, ct);
await _sms.SendAsync(phone, $"کد ورود شما به <PLACEHOLDER>: {code}", ct);
```

### Verify (`VerifyAsync`) — brute-force safe
- Returns `false` if there is no active code (expired/never sent).
- **Attempt cap** — at `MaxVerifyAttempts` wrong guesses, the active code is invalidated.
- **Constant-time compare** to avoid timing leaks; on success the code + attempt counter are
  cleared, on failure the attempt counter is incremented.

```csharp
var ok = CryptographicOperations.FixedTimeEquals(
    Encoding.UTF8.GetBytes(stored), Encoding.UTF8.GetBytes(code.Trim()));
if (ok) { await _cache.RemoveAsync(Key(phone), ct); await _cache.RemoveAsync(AttemptsKey(phone), ct); }
else    { /* increment attempts with TTL */ }
return ok;
```

### Options (`OtpOptions`, `SectionName = "Otp"`)
| Setting | Default | Meaning |
|---|---|---|
| `CodeLength` | 5 | digits in the code (**must match the client OTP length**) |
| `TtlSeconds` | 120 | code lifetime |
| `ResendCooldownSeconds` | 60 | min seconds between requests for a number |
| `MaxSendsPerHour` | 5 | hourly send cap per number |
| `MaxVerifyAttempts` | 5 | wrong guesses before invalidating the code |
| `LogCode` | false | log the generated code (**dev only**) |

In development, `appsettings.Development.json` sets `"Otp": { "LogCode": true }` so you can
read the code from the API logs without real SMS. The mobile client hardcodes the matching
length (`OTP_LENGTH = 5`) and auto-submits when the field is full.

---

## 2. SMS delivery (`ISmsSender` / `SmsSender`)

Contract (`Application/Common/Interfaces/ISmsSender.cs`): `Task SendAsync(string phoneNumber,
string message, CancellationToken ct = default)`.

`Infrastructure/Auth/SmsSender.cs` is an HTTP-client service that picks a provider from
config. Three modes:

- **`relay`** — POST `{ phone, code }` (the code is extracted from the message with a regex)
  to an external OTP relay microservice at `RelayBaseUrl/send`, authenticated with a bearer
  `RelayToken`. This is the production path in the reference deployment.
- **`kavenegar`** — call the Kavenegar HTTP API (a common Iranian SMS provider):
  `GET https://api.kavenegar.com/v1/{ApiKey}/sms/send.json?receptor=...&message=...&sender=...`.
- **`log`** (default, and whenever `ApiKey` is empty) — just logs the message. Used for
  local dev.

```csharp
public string Provider { get; set; } = "log";       // "relay" | "kavenegar" | "log"
public string? ApiKey { get; set; }
public string? Sender { get; set; }
public string RelayBaseUrl { get; set; } = "https://sms.<PLACEHOLDER>.example";
public string RelayToken  { get; set; } = "";        // injected via env var at deploy; never hardcoded
```

Send failures are **logged, not thrown** — a flaky SMS provider should not 500 the request.

### DI
Both are scoped; `SmsSender` is registered as a **typed HTTP client**:

```csharp
services.Configure<OtpOptions>(config.GetSection(OtpOptions.SectionName));
services.Configure<SmsOptions>(config.GetSection(SmsOptions.SectionName));
services.AddScoped<IOtpService, OtpService>();
services.AddHttpClient<ISmsSender, SmsSender>();
```

---

## 3. Configuration cheat-sheet

Local (logs the code):
```json
"Otp": { "LogCode": true }
// Sms omitted → defaults to Provider "log"
```

Production (env vars; never commit secrets):
```
Sms__Provider=relay
Sms__RelayBaseUrl=https://sms.<PLACEHOLDER>.example
Sms__RelayToken=<secret>            # or Sms__Provider=kavenegar + Sms__ApiKey=<secret>
Otp__LogCode=false
```

---

## 4. Recipe: add a new SMS provider

1. Add its settings to `SmsOptions` (e.g. `ApiKey`, base URL).
2. In `SmsSender.SendAsync`, add a branch matching `_options.Provider == "yourprovider"`
   that issues the HTTP call via the injected `HttpClient`; **log** (don't throw) on
   failure.
3. Set `Sms__Provider=yourprovider` + its secrets via environment variables in deployment.
   No changes to `OtpService` or the endpoints are needed — delivery is fully behind
   `ISmsSender`.
