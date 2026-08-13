using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common;
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

    // ── tblDW_EngineerProjectInfo dictionaries (org data dictionary, 2026-08-13) ──────────
    // Without these the reports print the raw code — "4" instead of «مسکن ملی».

    /// <summary>صلاحیت مهندس. 10 is absent from the org's list; unknown codes pass through raw.</summary>
    private static readonly IReadOnlyDictionary<string, string> TypEngLabels =
        new Dictionary<string, string>
        {
            ["1"] = "طراح معماری",  ["2"] = "طراح سازه",    ["3"] = "طراح برق",
            ["4"] = "طراح مکانیک",  ["5"] = "ناظر معماری",  ["6"] = "ناظر عمران",
            ["7"] = "ناظر برق",     ["8"] = "ناظر مکانیک",  ["9"] = "ناظر هماهنگ‌کننده",
            ["11"] = "ناظر نقشه‌برداری",
        };

    /// <summary>The bucket every undocumented TypProject code falls into. Not a real org code.</summary>
    private const string TypProjectOther = "9999";

    /// <summary>
    /// نوع پروژه. NOTE: <b>0 and 1 both mean عادی</b> — the org uses two codes for one kind.
    /// This map renames them both, which is display-only: grouping by TypProject still returns
    /// two rows that both read «عادی». Combining them has to happen in the query.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, string> TypProjectLabels =
        new Dictionary<string, string>
        {
            ["0"] = "عادی",                     ["1"] = "عادی",
            ["2"] = "صنعتی",                    ["4"] = "مسکن ملی",
            ["5"] = "بافت فرسوده",              ["6"] = "تخفیف همکار پروانه‌دار",
            ["7"] = "روستایی",                  ["8"] = "زیر ۲۰ هزار نفر",
            ["10"] = "مساجد و اماکن خیریه",     ["11"] = "مسکن ملی-سایت متمرکز",
            ["12"] = "خانه باغ",                ["15"] = "بازسازی ساختمان جنگ تحمیلی",
            // ~72 rows in the warehouse carry a code the org's dictionary does not list. Without
            // this they showed as one row per bare number; now they are one «سایر» row.
            [TypProjectOther] = "سایر",
        };

    /// <summary>شهرهای استان کردستان، به کد سازمان.</summary>
    private static readonly IReadOnlyDictionary<string, string> CityLabels =
        new Dictionary<string, string>
        {
            ["1"] = "بانه",      ["2"] = "سنندج (مرکزی)", ["18"] = "کامیاران",
            ["19"] = "قروه",     ["20"] = "سقز",          ["21"] = "دهگلان",
            ["22"] = "مریوان",   ["23"] = "دیواندره",     ["25"] = "بیجار",
        };

    // From Application.Common.ReshteNames — the single source of truth. Kept there rather than here
    // because the election cards and the Bale bot need the same mapping, and two copies of a lookup
    // table drift.
    private static readonly IReadOnlyDictionary<string, string> ReshteLabels =
        ReshteNames.All.ToDictionary(x => x.Key, x => x.Value);

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
            Table       = SourceToTable["oz_info"],
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

        // ── Entity: engineer_projects → tblDW_EngineerProjectInfo (اطلاعات پروژه‌ای) ──
        // Renamed 2026-08-13 from «کارکرد پروژه‌ای مهندسان». Source key deliberately unchanged, so
        // reports and dashboard widgets already saved against it keep working.
        new SemanticModelDto
        {
            ModelKey    = "model-engineer-projects",
            Name        = "اطلاعات پروژه‌ای مهندسان",
            Description = "پروژه‌های مهندسان: نوع پروژه، صلاحیت مهندس، شهر و متراژ درگیر در ظرفیت (tblDW_EngineerProjectInfo)",
            Source      = "engineer_projects",
            Table       = SourceToTable["engineer_projects"],
            Fields      =
            [
                new SemanticFieldDto { Id = "ProjectNo",  Name = "شماره پرونده",  Type = "string", Role = "dimension",
                    Description = "شماره پرونده پروژه" },
                new SemanticFieldDto { Id = "Ozviat",     Name = "کد عضویت",       Type = "number", Role = "dimension",
                    Description = "کد عضویت مهندسِ تخصیص‌یافته" },
                new SemanticFieldDto { Id = "TypEng",     Name = "صلاحیت مهندس",   Type = "number", Role = "dimension",
                    Description = "صلاحیت مهندس: 1=طراح معماری, 2=طراح سازه, 3=طراح برق, 4=طراح مکانیک, 5=ناظر معماری, 6=ناظر عمران, 7=ناظر برق, 8=ناظر مکانیک, 9=ناظر هماهنگ‌کننده, 11=ناظر نقشه‌برداری. صلاحیت‌های 1 تا 4 طراحی و 5 تا 11 نظارت هستند",
                    ValueLabels = TypEngLabels },
                new SemanticFieldDto { Id = "IsHogh",     Name = "حقیقی/حقوقی",    Type = "number", Role = "dimension",
                    Description = "1=حقوقی, 0=حقیقی", ValueLabels = HoghLabels },
                new SemanticFieldDto { Id = "IsErja",     Name = "ارجاعی",         Type = "number", Role = "dimension",
                    Description = "1=پروژه ارجاعی است و صلاحیت مهندس آن از نوع ناظر است, 0=پروژه ارجاعی نیست و صلاحیت مهندس آن از نوع طراح است",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "ارجاعی", ["0"] = "غیرارجاعی" } },
                new SemanticFieldDto { Id = "IsHal",      Name = "وضعیت جاری",     Type = "number", Role = "dimension",
                    Description = "1=در حال کار",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "در حال کار", ["0"] = "خاتمه‌یافته" } },
                new SemanticFieldDto { Id = "RegDate",    Name = "تاریخ درج در ظرفیت", Type = "string", Role = "dimension",
                    Description = "تاریخ درج پروژه در ظرفیت مهندس، شمسی و همیشه به شکل 1405/03/17. برای فیلتر یک سال، بازه 1405/01/01 تا 1405/12/29 استفاده شود" },
                new SemanticFieldDto { Id = "TypProject", Name = "نوع پروژه",      Type = "number", Role = "dimension",
                    Description = "نوع پروژه: 0 و 1 هر دو=عادی, 2=صنعتی, 4=مسکن ملی, 5=بافت فرسوده, 6=تخفیف همکار پروانه‌دار, 7=روستایی, 8=زیر ۲۰ هزار نفر, 10=مساجد و اماکن خیریه, 11=مسکن ملی-سایت متمرکز, 12=خانه باغ, 15=بازسازی ساختمان جنگ تحمیلی",
                    ValueLabels = TypProjectLabels,
                    // 0 and 1 are one kind with two codes. Folded in the GROUP BY so عادی is a
                    // single row with a single count and a single percentage.
                    EquivalentCodes = new Dictionary<string, string> { ["0"] = "1" },
                    // Anything the dictionary above does not list — and NULL — becomes one «سایر».
                    OtherCode = TypProjectOther },
                new SemanticFieldDto { Id = "CityId",     Name = "شهر",            Type = "number", Role = "dimension",
                    Description = "شهر محل پروژه: 1=بانه, 2=سنندج (مرکزی), 18=کامیاران, 19=قروه, 20=سقز, 21=دهگلان, 22=مریوان, 23=دیواندره, 25=بیجار",
                    ValueLabels = CityLabels },
                new SemanticFieldDto { Id = "HasPayan",   Name = "پایان‌کار",       Type = "number", Role = "dimension",
                    Description = "1=دارای پایان‌کار",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "دارد", ["0"] = "ندارد" } },
                new SemanticFieldDto { Id = "ExitTyp",    Name = "نوع خروج",       Type = "number", Role = "dimension",
                    Description = "نوع خروج از پروژه (کد داخلی سازمان)" },
                new SemanticFieldDto { Id = "IsAfza",     Name = "توسعه بنا",      Type = "number", Role = "dimension",
                    Description = "1=توسعه بنا, 0=عادی",
                    ValueLabels = new Dictionary<string, string> { ["1"] = "توسعه بنا", ["0"] = "عادی" } },
                // Measures
                new SemanticFieldDto { Id = "Meter",      Name = "متراژ درگیر در ظرفیت", Type = "number", Role = "measure",
                    Description = "متراژ درگیر در ظرفیت مهندس (مترمربع) — همان «متر کار»" },
                new SemanticFieldDto { Id = "MeterFull",  Name = "متراژ کل پروژه", Type = "number", Role = "measure",
                    Description = "متراژ کل پروژه (مترمربع)" },
            ],
        },
    ];
}
