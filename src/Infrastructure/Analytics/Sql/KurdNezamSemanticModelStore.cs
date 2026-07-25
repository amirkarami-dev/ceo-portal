using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// Semantic model store for the KurdNezam (نظام مهندسی کردستان) warehouse tables.
/// Two curated models over real SQL Server tables; every field <c>Id</c> equals the SQL column
/// name, and the field <c>Description</c> carries the CODE dictionaries (per the org's data
/// dictionary) so the AI maps Persian requests to the right raw values.
/// </summary>
internal sealed class KurdNezamSemanticModelStore : ISemanticModelStore
{
    // ── Source key → real table name map (used by SqlQueryEngine) ────────────
    internal static readonly IReadOnlyDictionary<string, string> SourceToTable =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["oz_info"]           = "tblDW_OzviatInfo",
            ["engineer_projects"] = "tblDW_EngineerProjectInfo",
        };

    /// <summary>"1=پایه یک…" — shared by the three پایه fields.</summary>
    private const string PayeDict = "1=پایه یک, 2=پایه دو, 3=پایه سه, -1=ارشد, 0=ندارد";

    // Code → label maps applied to result rows (the AI/SQL side keeps raw codes; see
    // SqlQueryEngine.ApplyValueLabels). Keys are normalised code strings; bit columns
    // normalise to "1"/"0".
    private static readonly IReadOnlyDictionary<string, string> PayeLabels =
        new Dictionary<string, string>
        {
            ["1"] = "پایه یک", ["2"] = "پایه دو", ["3"] = "پایه سه", ["-1"] = "ارشد", ["0"] = "ندارد",
        };

    private static readonly IReadOnlyDictionary<string, string> HoghLabels =
        new Dictionary<string, string> { ["1"] = "حقوقی", ["0"] = "حقیقی" };

    private static readonly IReadOnlyDictionary<string, string> TypDftrLabels =
        new Dictionary<string, string>
        {
            ["0"]  = "فقط حقیقی",
            ["11"] = "حقیقی عضو دفتر طراحی",
            ["12"] = "حقوقی نظارت و طراحی",
            ["21"] = "حقیقی مجری",
            ["22"] = "حقوقی مجری",
            ["32"] = "حقوقی آزمایشگاه",
        };

    private static readonly IReadOnlyDictionary<string, string> ReshteLabels =
        new Dictionary<string, string>
        {
            ["1"] = "معماری", ["2"] = "شهرسازی", ["3"] = "عمران", ["4"] = "مکانیک",
            ["5"] = "برق", ["6"] = "نقشه‌برداری", ["7"] = "ترافیک",
        };

    private static readonly IReadOnlyList<SemanticModelDto> Catalogue = BuildCatalogue();

    public Task<IReadOnlyList<SemanticModelDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(Catalogue);

    public Task<SemanticModelDto?> GetByIdAsync(string modelKey, CancellationToken cancellationToken = default)
    {
        var model = Catalogue.FirstOrDefault(m =>
            string.Equals(m.ModelKey, modelKey, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(model);
    }

    public Task<SemanticModelDto?> GetBySourceAsync(string source, CancellationToken cancellationToken = default)
    {
        var model = Catalogue.FirstOrDefault(m =>
            string.Equals(m.Source, source, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(model);
    }

    // ── Catalogue ─────────────────────────────────────────────────────────────

    private static IReadOnlyList<SemanticModelDto> BuildCatalogue() =>
    [
        // ── Entity: oz_info → tblDW_OzviatInfo (پروانه/عضویت مهندسان) ─────────
        new SemanticModelDto
        {
            ModelKey    = "model-oz-info",
            Name        = "اعضا و پروانه‌ها",
            Description = "اطلاعات عضویت و پروانه مهندسان استان کردستان (tblDW_OzviatInfo)",
            Source      = "oz_info",
            Fields      =
            [
                new SemanticFieldDto { Id = "Ozviat",       Name = "کد عضویت",        Type = "number", Role = "dimension",
                    Description = "کد عضویت مهندس" },
                new SemanticFieldDto { Id = "PayeT",        Name = "پایه طراحی",      Type = "number", Role = "dimension",
                    Description = $"پایه طراحی: {PayeDict}", ValueLabels = PayeLabels },
                new SemanticFieldDto { Id = "PayeNez",      Name = "پایه نظارت",      Type = "number", Role = "dimension",
                    Description = $"پایه نظارت: {PayeDict}", ValueLabels = PayeLabels },
                new SemanticFieldDto { Id = "MaxPaye",      Name = "بالاترین پایه",   Type = "number", Role = "dimension",
                    Description = $"بالاترین پایه اخذشده: {PayeDict}", ValueLabels = PayeLabels },
                new SemanticFieldDto { Id = "IsHogh",       Name = "حقیقی/حقوقی",     Type = "number", Role = "dimension",
                    Description = "1=حقوقی, 0=حقیقی", ValueLabels = HoghLabels },
                new SemanticFieldDto { Id = "TypDftr",      Name = "نوع شخصیت",       Type = "number", Role = "dimension",
                    Description = "0=فقط حقیقی, 11=حقیقی عضو دفتر طراحی, 12=حقوقی نظارت و طراحی, 21=حقیقی مجری, 22=حقوقی مجری, 32=حقوقی آزمایشگاه", ValueLabels = TypDftrLabels },
                new SemanticFieldDto { Id = "ExpDate",      Name = "اعتبار پروانه",   Type = "string", Role = "dimension",
                    Description = "تاریخ اعتبار پروانه، شمسی مانند 1405/05/01" },
                new SemanticFieldDto { Id = "RegInErja",    Name = "ثبت‌نام در ارجاع", Type = "number", Role = "dimension",
                    Description = "ثبت‌نام در سامانه ارجاع کار: 1=ثبت‌نام کرده, 0=نکرده",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "ثبت‌نام کرده", ["0"] = "ثبت‌نام نکرده" } },
                new SemanticFieldDto { Id = "Reshte",       Name = "رشته",            Type = "string", Role = "dimension",
                    Description = "رشته مهندسی: 1=معماری, 2=شهرسازی, 3=عمران, 4=مکانیک, 5=برق, 6=نقشه‌برداری, 7=ترافیک", ValueLabels = ReshteLabels },
                new SemanticFieldDto { Id = "LastWorkDate", Name = "آخرین تخصیص",     Type = "string", Role = "dimension",
                    Description = "تاریخ آخرین تخصیص کار، شمسی" },
                // Measures
                new SemanticFieldDto { Id = "ActiveInErja", Name = "تعداد شرکت در ارجاع", Type = "number", Role = "measure",
                    Description = "تعداد دفعات شرکت در ارجاع کار" },
            ],
        },

        // ── Entity: engineer_projects → tblDW_EngineerProjectInfo (کارکرد پروژه‌ای) ──
        new SemanticModelDto
        {
            ModelKey    = "model-engineer-projects",
            Name        = "کارکرد پروژه‌ای مهندسان",
            Description = "تخصیص مهندسان به پروژه‌ها و متراژ کارکرد (tblDW_EngineerProjectInfo)",
            Source      = "engineer_projects",
            Fields      =
            [
                new SemanticFieldDto { Id = "ProjectNo",  Name = "شماره پرونده",  Type = "string", Role = "dimension",
                    Description = "شماره پرونده پروژه" },
                new SemanticFieldDto { Id = "Ozviat",     Name = "کد عضویت",       Type = "number", Role = "dimension",
                    Description = "کد عضویت مهندسِ تخصیص‌یافته" },
                new SemanticFieldDto { Id = "TypEng",     Name = "نوع خدمت",       Type = "number", Role = "dimension",
                    Description = "نوع خدمت مهندس در پروژه (کد داخلی سازمان)" },
                new SemanticFieldDto { Id = "IsHogh",     Name = "حقیقی/حقوقی",    Type = "number", Role = "dimension",
                    Description = "1=حقوقی, 0=حقیقی", ValueLabels = HoghLabels },
                new SemanticFieldDto { Id = "IsErja",     Name = "از طریق ارجاع",  Type = "number", Role = "dimension",
                    Description = "1=تخصیص از طریق سامانه ارجاع, 0=خارج از ارجاع",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "از طریق ارجاع", ["0"] = "خارج از ارجاع" } },
                new SemanticFieldDto { Id = "IsHal",      Name = "وضعیت جاری",     Type = "number", Role = "dimension",
                    Description = "1=در حال کار",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "در حال کار", ["0"] = "خاتمه‌یافته" } },
                new SemanticFieldDto { Id = "RegDate",    Name = "تاریخ ثبت",      Type = "string", Role = "dimension",
                    Description = "تاریخ ثبت تخصیص، شمسی مانند 1405/05/01" },
                new SemanticFieldDto { Id = "TypProject", Name = "نوع پروژه",      Type = "number", Role = "dimension",
                    Description = "نوع پروژه (کد داخلی سازمان)" },
                new SemanticFieldDto { Id = "CityId",     Name = "شهر",            Type = "number", Role = "dimension",
                    Description = "کد شهر محل پروژه" },
                new SemanticFieldDto { Id = "HasPayan",   Name = "پایان‌کار",       Type = "number", Role = "dimension",
                    Description = "1=دارای پایان‌کار",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "دارد", ["0"] = "ندارد" } },
                new SemanticFieldDto { Id = "ExitTyp",    Name = "نوع خروج",       Type = "number", Role = "dimension",
                    Description = "نوع خروج از پروژه (کد داخلی سازمان)" },
                new SemanticFieldDto { Id = "IsAfza",     Name = "افزایش بنا",     Type = "number", Role = "dimension",
                    Description = "1=پروژه افزایش بنا",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "افزایش بنا", ["0"] = "عادی" } },
                // Measures
                new SemanticFieldDto { Id = "Meter",      Name = "متراژ",          Type = "number", Role = "measure",
                    Description = "متراژ کارکرد این تخصیص (مترمربع)" },
                new SemanticFieldDto { Id = "MeterFull",  Name = "متراژ کل",       Type = "number", Role = "measure",
                    Description = "متراژ کل پروژه (مترمربع)" },
            ],
        },
    ];
}
