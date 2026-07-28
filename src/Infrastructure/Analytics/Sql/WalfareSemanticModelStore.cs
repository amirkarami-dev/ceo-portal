using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// Semantic models for the welfare service (سامانه رفاهی مهندسین).
///
/// Unlike the KurdNezam models, these tables live in **CeoDb** — this application's own database,
/// written by EF Core — not in the analytics warehouse. That is why every model here sets
/// <see cref="SemanticModelDto.ConnectionName"/> to <see cref="SemanticConnections.CeoDb"/>.
///
/// Every field <c>Id</c> is the real SQL column name, and enum columns are stored as ints, so the
/// <c>Description</c> carries the code dictionary and <c>ValueLabels</c> turns codes back into
/// Persian in the result rows — the same contract the KurdNezam store uses.
///
/// PII is deliberately excluded. <c>NationalCode</c>, <c>Mobile</c>, <c>PayerNationalCode</c>,
/// <c>MaskedPan</c> and the gateway reference numbers are NOT exposed: an ad-hoc report builder is
/// the wrong place to hand out personal and card data. Names are kept only where a report is
/// meaningless without them.
/// </summary>
internal sealed class WalfareSemanticModelStore : ISemanticModelStore
{
    /// <summary>Source key → real EF table name. Same whitelist role as the KurdNezam map.</summary>
    internal static readonly IReadOnlyDictionary<string, string> SourceToTable =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["walfare_reservations"] = "WelfarePoolReservations",
            ["walfare_payments"]     = "PaymentTransactions",
            ["walfare_pools"]        = "WelfarePools",
        };

    // ── Code → label maps (enums are stored as ints; see Domain/Walfare) ──────

    /// <summary>ReservationStatus: 0=PendingPayment, 1=Paid, 2=Cancelled.</summary>
    private static readonly IReadOnlyDictionary<string, string> ReservationStatusLabels =
        new Dictionary<string, string>
        {
            ["0"] = "در انتظار پرداخت", ["1"] = "پرداخت‌شده", ["2"] = "لغوشده",
        };

    /// <summary>PaymentStatus: 0=Initiated, 1=Succeeded, 2=Failed.</summary>
    private static readonly IReadOnlyDictionary<string, string> PaymentStatusLabels =
        new Dictionary<string, string>
        {
            ["0"] = "آغازشده", ["1"] = "موفق", ["2"] = "ناموفق",
        };

    /// <summary>PaymentGateway: 1=IranKish (the only gateway today).</summary>
    private static readonly IReadOnlyDictionary<string, string> GatewayLabels =
        new Dictionary<string, string> { ["1"] = "ایران کیش" };

    private static readonly IReadOnlyDictionary<string, string> YesNoLabels =
        new Dictionary<string, string> { ["1"] = "بله", ["0"] = "خیر" };

    private static readonly IReadOnlyList<SemanticModelDto> Catalogue = BuildCatalogue();

    public Task<IReadOnlyList<SemanticModelDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(Catalogue);

    public Task<SemanticModelDto?> GetByIdAsync(string modelKey, CancellationToken cancellationToken = default)
        => Task.FromResult(Catalogue.FirstOrDefault(m =>
            string.Equals(m.ModelKey, modelKey, StringComparison.OrdinalIgnoreCase)));

    public Task<SemanticModelDto?> GetBySourceAsync(string source, CancellationToken cancellationToken = default)
        => Task.FromResult(Catalogue.FirstOrDefault(m =>
            string.Equals(m.Source, source, StringComparison.OrdinalIgnoreCase)));

    // ── Catalogue ─────────────────────────────────────────────────────────────

    private static IReadOnlyList<SemanticModelDto> BuildCatalogue() =>
    [
        // ── رزروهای استخر → WelfarePoolReservations ───────────────────────────
        new SemanticModelDto
        {
            ModelKey       = "model-walfare-reservations",
            Name           = "رزروهای سامانه رفاهی",
            Description    = "رزرو بلیط خدمات رفاهی مهندسان (استخر و سایر خدمات) به همراه وضعیت پرداخت و مبلغ",
            Source         = "walfare_reservations",
            Table          = SourceToTable["walfare_reservations"],
            ConnectionName = SemanticConnections.CeoDb,
            Fields         =
            [
                new SemanticFieldDto { Id = "PoolId", Name = "استخر/سانس", Type = "number", Role = "dimension",
                    Description = "شناسه استخر یا سانس رزروشده",
                    LookupTable = "WelfarePools", LookupKeyColumn = "Id", LookupNameColumn = "Name" },
                new SemanticFieldDto { Id = "Status", Name = "وضعیت رزرو", Type = "number", Role = "dimension",
                    Description = "وضعیت رزرو: 0=در انتظار پرداخت, 1=پرداخت‌شده, 2=لغوشده",
                    ValueLabels = ReservationStatusLabels },
                new SemanticFieldDto { Id = "ReshteCode", Name = "رشته", Type = "string", Role = "dimension",
                    Description = "کد رشته مهندسیِ رزروکننده، از سامانه نظام مهندسی" },
                new SemanticFieldDto { Id = "FullName", Name = "نام رزروکننده", Type = "string", Role = "dimension",
                    Description = "نام و نام خانوادگی مهندس در زمان رزرو" },
                new SemanticFieldDto { Id = "DateJalali", Name = "تاریخ رزرو (شمسی)", Type = "string", Role = "dimension",
                    Description = "روزِ رزروشده به شمسی مانند 1405/05/01" },
                new SemanticFieldDto { Id = "Date", Name = "تاریخ رزرو", Type = "date", Role = "date",
                    Description = "همان روز رزرو، میلادی — برای بازه و مرتب‌سازی" },
                new SemanticFieldDto { Id = "Created", Name = "زمان ثبت", Type = "date", Role = "date",
                    Description = "زمان ثبت رزرو در سامانه" },
                // Measures
                new SemanticFieldDto { Id = "AmountRials", Name = "مبلغ (ریال)", Type = "number", Role = "measure",
                    Description = "مبلغ رزرو به ریال" },
            ],
        },

        // ── تراکنش‌های پرداخت → PaymentTransactions ───────────────────────────
        new SemanticModelDto
        {
            ModelKey       = "model-walfare-payments",
            Name           = "پرداخت‌های سامانه رفاهی",
            Description    = "تراکنش‌های درگاه پرداخت خدمات رفاهی: موفق، ناموفق و در انتظار",
            Source         = "walfare_payments",
            Table          = SourceToTable["walfare_payments"],
            ConnectionName = SemanticConnections.CeoDb,
            Fields         =
            [
                new SemanticFieldDto { Id = "Status", Name = "وضعیت پرداخت", Type = "number", Role = "dimension",
                    Description = "وضعیت تراکنش: 0=آغازشده, 1=موفق, 2=ناموفق",
                    ValueLabels = PaymentStatusLabels },
                new SemanticFieldDto { Id = "Gateway", Name = "درگاه", Type = "number", Role = "dimension",
                    Description = "درگاه پرداخت: 1=ایران کیش", ValueLabels = GatewayLabels },
                new SemanticFieldDto { Id = "TargetType", Name = "نوع خدمت", Type = "string", Role = "dimension",
                    Description = "خدمتی که پرداخت بابت آن انجام شده، مانند رزرو استخر" },
                new SemanticFieldDto { Id = "PayerName", Name = "نام پرداخت‌کننده", Type = "string", Role = "dimension",
                    Description = "نام پرداخت‌کننده در زمان تراکنش" },
                new SemanticFieldDto { Id = "Created", Name = "زمان تراکنش", Type = "date", Role = "date",
                    Description = "زمان آغاز تراکنش" },
                new SemanticFieldDto { Id = "VerifiedAt", Name = "زمان تأیید", Type = "date", Role = "date",
                    Description = "زمان تأیید نهایی توسط درگاه؛ برای تراکنش ناموفق خالی است" },
                // Measures
                new SemanticFieldDto { Id = "AmountRials", Name = "مبلغ (ریال)", Type = "number", Role = "measure",
                    Description = "مبلغ تراکنش به ریال" },
            ],
        },

        // ── استخرها/سانس‌ها → WelfarePools ────────────────────────────────────
        new SemanticModelDto
        {
            ModelKey       = "model-walfare-pools",
            Name           = "استخرها و سانس‌های رفاهی",
            Description    = "سانس‌های تعریف‌شده خدمات رفاهی به همراه ظرفیت و قیمت",
            Source         = "walfare_pools",
            Table          = SourceToTable["walfare_pools"],
            ConnectionName = SemanticConnections.CeoDb,
            Fields         =
            [
                new SemanticFieldDto { Id = "Name", Name = "نام سانس", Type = "string", Role = "dimension",
                    Description = "نام سانس یا استخر" },
                new SemanticFieldDto { Id = "ServiceId", Name = "خدمت", Type = "number", Role = "dimension",
                    Description = "شناسه خدمت رفاهی که این سانس به آن تعلق دارد",
                    LookupTable = "WelfareServices", LookupKeyColumn = "Id", LookupNameColumn = "Title" },
                new SemanticFieldDto { Id = "IsActive", Name = "فعال", Type = "number", Role = "dimension",
                    Description = "1=فعال, 0=غیرفعال", ValueLabels = YesNoLabels },
                new SemanticFieldDto { Id = "ReserveStartTime", Name = "ساعت شروع", Type = "string", Role = "dimension",
                    Description = "ساعت شروع سانس" },
                // Measures
                new SemanticFieldDto { Id = "Capacity", Name = "ظرفیت", Type = "number", Role = "measure",
                    Description = "ظرفیت هر روز این سانس" },
                new SemanticFieldDto { Id = "PriceRials", Name = "قیمت (ریال)", Type = "number", Role = "measure",
                    Description = "قیمت هر بلیط به ریال" },
            ],
        },
    ];
}
