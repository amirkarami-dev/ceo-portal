# File Storage & PDF Reports

`<PLACEHOLDER>` stores generated files in **MinIO** (S3-compatible object storage) behind a
clean `IFileStorage` interface, and renders Persian/RTL **PDF reports with QuestPDF**. The
two come together in the "generate report" use case: render PDF → upload to MinIO → return a
time-limited presigned download URL.

---

## 1. File storage: `IFileStorage` over MinIO

### The contract (Application)
`Application/Common/Interfaces/IFileStorage.cs` keeps the rest of the app independent of the
storage provider:

```csharp
public interface IFileStorage
{
    Task PutAsync(string key, Stream content, string contentType, CancellationToken ct = default);
    Task<Stream> GetAsync(string key, CancellationToken ct = default);
    Task DeleteAsync(string key, CancellationToken ct = default);
    Task<string> GetPresignedUrlAsync(string key, TimeSpan expiry, CancellationToken ct = default);
}
```

### The implementation (Infrastructure)
`Infrastructure/Storage/MinioFileStorage.cs` uses the MinIO .NET SDK. Notable behaviours:

- **Lazy bucket creation** — `EnsureBucketAsync` checks/creates the bucket once before the
  first put (cached with a `_bucketChecked` flag).
- **Presigned URLs** for downloads, with a **public-endpoint rewrite** so the URL works in a
  browser even when the app talks to MinIO over an internal address.

```csharp
public async Task<string> GetPresignedUrlAsync(string key, TimeSpan expiry, CancellationToken ct = default)
{
    var url = await _client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
        .WithBucket(_options.Bucket).WithObject(key)
        .WithExpiry((int)expiry.TotalSeconds));

    // Rewrite host when a public endpoint differs from the internal one (behind a proxy).
    if (!string.IsNullOrWhiteSpace(_options.PublicEndpoint))
    {
        var builder = new UriBuilder(url);
        var pub = new Uri(_options.PublicEndpoint!.Contains("://") ? _options.PublicEndpoint! : $"https://{_options.PublicEndpoint}");
        builder.Scheme = pub.Scheme; builder.Host = pub.Host;
        builder.Port = pub.IsDefaultPort ? -1 : pub.Port;
        url = builder.Uri.ToString();
    }
    return url;
}
```

### Options & DI
`MinioOptions` (`SectionName = "Minio"`) holds endpoint/credentials/bucket/SSL plus the
optional `PublicEndpoint`:

```csharp
public string Endpoint { get; set; } = "localhost:9000";
public string AccessKey { get; set; } = "minioadmin";
public string SecretKey { get; set; } = "minioadmin";
public string Bucket { get; set; } = "<PLACEHOLDER>";
public bool UseSSL { get; set; } = false;
public string? PublicEndpoint { get; set; }   // e.g. s3.<host> behind Traefik
```

Registered in `Infrastructure/DependencyInjection.cs` — the `IMinioClient` is a singleton
built from options, the storage is scoped:

```csharp
services.Configure<MinioOptions>(config.GetSection(MinioOptions.SectionName));
services.AddSingleton<IMinioClient>(sp => {
    var o = sp.GetRequiredService<IOptions<MinioOptions>>().Value;
    return new MinioClient().WithEndpoint(o.Endpoint).WithCredentials(o.AccessKey, o.SecretKey).WithSSL(o.UseSSL).Build();
});
services.AddScoped<IFileStorage, MinioFileStorage>();
```

### Local vs production
- **Local/dev** (`appsettings.Development.json`): `Endpoint=localhost:9000`,
  `minioadmin/minioadmin`, `UseSSL=false`, `PublicEndpoint=""`. MinIO runs from
  `deploy/docker-compose.dev.yml`.
- **Production**: MinIO is reached via its **public host** with TLS
  (`Minio__Endpoint=s3.<host>`, `UseSSL=true`) so presigned URLs are valid for browsers and
  no host rewrite is needed (or `PublicEndpoint` is set when the internal/external hosts
  differ).

---

## 2. PDF reports: QuestPDF (Persian / RTL)

### Contract & model
`Application/Common/Interfaces/IReportGenerator.cs`:

```csharp
public interface IReportGenerator
{
    byte[] GenerateAssessmentReport(AssessmentReportModel model);
}
```

`AssessmentReportModel` (`Application/Reports/`) is a flat, render-ready DTO: project meta,
climate label, building-group label, total/max score, and a list of per-section
`(Key, Title, Score, MaxScore)`. The handler builds it from stored data — the generator does
**no** business logic, only layout.

### The generator (Infrastructure)
`Infrastructure/Reporting/QuestPdfReportGenerator.cs` builds an A4 document. The RTL pieces:

```csharp
page.ContentFromRightToLeft();                                  // RTL flow
page.DefaultTextStyle(x => x.FontFamily(ReportFonts.PersianFamily).FontSize(11));
col.Item().Text("گزارش ارزیابی جامع انرژی ساختمان").FontSize(18).Bold();   // Persian headings
```

It renders a meta table, a per-section results table (pass/needs-improvement coloring), and
a total-score box, then `return document.GeneratePdf();` (a `byte[]`).

### Persian font registration (do this once at startup)
QuestPDF must be told about a Persian-capable TTF. `Infrastructure/Reporting/ReportFonts.cs`
registers every `.ttf` in `{ContentRoot}/Fonts/`:

```csharp
public const string PersianFamily = "Vazirmatn";
public static void Register(string contentRootPath)
{
    var fontsDir = Path.Combine(contentRootPath, "Fonts");
    if (Directory.Exists(fontsDir))
        foreach (var ttf in Directory.EnumerateFiles(fontsDir, "*.ttf"))
            { using var s = File.OpenRead(ttf); FontManager.RegisterFont(s); }
}
```

And in DI, set the license + register fonts before the generator is used:

```csharp
QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
ReportFonts.Register(builder.Environment.ContentRootPath);
services.AddScoped<IReportGenerator, QuestPdfReportGenerator>();
```

> Ship the `Fonts/Vazirmatn-Regular.ttf` (+ `-Bold`) with the app and install them in the
> Docker image. Without a registered Persian font, QuestPDF renders boxes/blanks for
> Persian text. QuestPDF runs under the **Community** license here.

---

## 3. The two together: generate → store → presigned URL

`Application/Assessments/Commands/GenerateReport/GenerateReport.cs` shows the end-to-end
flow (and the error handling from `coding-standards.md`):

```csharp
var project = await _context.Projects.Include(p => p.Assessment)
    .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct);
Guard.Against.NotFound(request.ProjectId, project);               // 404
if (project.OwnerId != _user.Id) throw new ForbiddenAccessException();   // 403
if (project.Assessment is null) { /* app ValidationException → 400 "no assessment" */ }

var model = /* build AssessmentReportModel from project + assessment.ResultJson */;
var pdf = _reportGenerator.GenerateAssessmentReport(model);

var fileName   = $"<PLACEHOLDER>-report-{project.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
var storageKey = $"reports/{project.OwnerId}/{fileName}";          // per-owner key prefix
using (var ms = new MemoryStream(pdf))
    await _storage.PutAsync(storageKey, ms, "application/pdf", ct);

assessment.Reports.Add(new AssessmentReport { AssessmentId = assessment.Id, StorageKey = storageKey, FileName = fileName, Size = pdf.Length });
await _context.SaveChangesAsync(ct);

var url = await _storage.GetPresignedUrlAsync(storageKey, TimeSpan.FromHours(1), ct);
return new GenerateReportResult(url, fileName);                    // browser downloads via URL
```

Patterns to copy:
- **Object key convention**: `reports/{ownerId}/{fileName}` — namespaced by owner.
- **Record the artifact**: persist an `AssessmentReport` row (key, file name, size) so it is
  queryable later.
- **Return a presigned URL**, not the bytes — the client downloads directly from MinIO
  (1-hour expiry here). The endpoint is `POST /api/Projects/{id}/report` → `{ downloadUrl }`.

---

## 4. Recipe: store and serve a new file type

1. Inject `IFileStorage` into your handler.
2. Choose a namespaced key (`<area>/{ownerId}/{name}`); `PutAsync(key, stream,
   contentType)`.
3. If users need to download it, return `await GetPresignedUrlAsync(key, expiry)`; otherwise
   read it back with `GetAsync(key)`.
4. Persist a metadata row if the file must be listed/managed later.
5. Reuse the same bucket; no extra DI is needed.
