namespace Mabhas19.Infrastructure.Analytics.Query;

/// <summary>
/// In-memory sample datasets ported verbatim from the frontend TypeScript files:
///   analytics-web/src/semantic/datasets/{project,sales,finance}.ts
///
/// Rows are keyed by RAW COLUMN NAME (e.g. "areaM2", "qty") exactly as in the
/// TypeScript datasets, so the QueryEngine's id→column lookup resolves correctly.
/// </summary>
internal static class SampleDataStore
{
    // ──────────────────────────────────────────────────────────────────────────
    // Projects dataset  (source key: "projects")
    // ──────────────────────────────────────────────────────────────────────────

    private static readonly IReadOnlyList<IReadOnlyDictionary<string, object?>> ProjectRows =
    [
        Row("P-1001", "برج مسکونی نیلوفر",  "تهران",   "در حال اجرا", "گروه ۴", 8200d,  78.5d, 45d,  "2025-01-10", "2025-03-01"),
        Row("P-1002", "مجتمع تجاری آرین",   "تهران",   "در حال اجرا", "گروه ۳", 5400d,  64.0d, 60d,  "2025-01-22", "2025-02-15"),
        Row("P-1003", "ساختمان اداری پارس", "تهران",   "متوقف",       "گروه ۲", 3100d,  55.0d, 90d,  "2024-12-05", "2025-01-20"),
        Row("P-1004", "ویلا باغ شمال",      "تهران",   "completed",   "گروه ۱",  420d,  88.0d,  0d,  "2025-01-30", "2025-03-10"),
        Row("P-1005", "هتل اصفهان",         "اصفهان",  "در حال اجرا", "گروه ۴", 9600d,  71.0d, 50d,  "2025-02-01", "2025-04-01"),
        Row("P-1006", "بیمارستان زهرا",     "اصفهان",  "متوقف",       "گروه ۴", 12000d, 62.0d, 120d, "2024-11-15", "2025-01-05"),
        Row("P-1007", "مدرسه نمونه",        "اصفهان",  "completed",   "گروه ۲", 2200d,  80.0d,  0d,  "2025-03-02", "2025-05-01"),
        Row("P-1008", "پالایشگاه جنوب",     "خوزستان", "در حال اجرا", "گروه ۴", 15000d, 58.0d, 35d,  "2025-02-20", "2025-04-20"),
        Row("P-1009", "اسکله بندر",         "خوزستان", "در حال اجرا", "گروه ۳", 6800d,  66.0d, 70d,  "2025-01-08", "2025-03-15"),
        Row("P-1010", "انبار صنعتی",        "خوزستان", "completed",   "گروه ۱", 4000d,  75.0d,  0d,  "2025-03-18", "2025-05-10"),
        Row("P-1011", "مرکز خرید فارس",     "فارس",    "در حال اجرا", "گروه ۳", 7200d,  69.0d, 40d,  "2025-02-11", "2025-04-10"),
        Row("P-1012", "پارک علم و فناوری",  "فارس",    "completed",   "گروه ۲", 5000d,  82.0d,  0d,  "2025-03-25", "2025-05-25"),
    ];

    private static IReadOnlyDictionary<string, object?> Row(
        string id, string name, string province, string status,
        string buildingGroup, double areaM2, double score, double delayDays,
        string startDate, string dueDate) =>
        new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["id"]            = id,
            ["name"]          = name,
            ["province"]      = province,
            ["status"]        = status,
            ["buildingGroup"] = buildingGroup,
            ["areaM2"]        = areaM2,
            ["score"]         = score,
            ["delayDays"]     = delayDays,
            ["startDate"]     = startDate,
            ["dueDate"]       = dueDate,
        };

    // ──────────────────────────────────────────────────────────────────────────
    // Sales dataset  (source key: "sales")
    // ──────────────────────────────────────────────────────────────────────────

    private static readonly IReadOnlyList<IReadOnlyDictionary<string, object?>> SalesRows =
    [
        SRow("S-001", "شرکت آلفا",    "سیمان تیپ ۲", "مصالح", "تهران",   "آنلاین", "paid",      120d, 360_000_000d, "2025-01-15"),
        SRow("S-002", "شرکت آلفا",    "میلگرد A3",   "فولاد", "تهران",   "حضوری",  "delivered",  40d, 880_000_000d, "2025-02-03"),
        SRow("S-003", "شرکت آلفا",    "آجر نسوز",    "مصالح", "تهران",   "آنلاین", "shipped",   200d, 260_000_000d, "2025-03-11"),
        SRow("S-004", "شرکت بتا",     "سیمان تیپ ۲", "مصالح", "اصفهان",  "آنلاین", "paid",       90d, 270_000_000d, "2025-01-20"),
        SRow("S-005", "شرکت بتا",     "گچ",          "مصالح", "اصفهان",  "حضوری",  "delivered", 300d, 150_000_000d, "2025-02-18"),
        SRow("S-006", "شرکت بتا",     "میلگرد A3",   "فولاد", "اصفهان",  "آنلاین", "cancelled",  50d, 500_000_000d, "2025-03-05"),
        SRow("S-007", "شرکت گاما",    "تیرآهن",      "فولاد", "خوزستان", "حضوری",  "delivered",  30d, 1_200_000_000d, "2025-01-28"),
        SRow("S-008", "شرکت گاما",    "میلگرد A3",   "فولاد", "خوزستان", "آنلاین", "paid",       60d, 900_000_000d, "2025-02-14"),
        SRow("S-009", "شرکت گاما",    "سیمان تیپ ۲", "مصالح", "خوزستان", "حضوری",  "shipped",   110d, 330_000_000d, "2025-04-09"),
        SRow("S-010", "شرکت دلتا",    "کاشی",        "مصالح", "فارس",    "آنلاین", "paid",      500d, 450_000_000d, "2025-01-31"),
        SRow("S-011", "شرکت دلتا",    "سرامیک",      "مصالح", "فارس",    "آنلاین", "delivered", 400d, 520_000_000d, "2025-02-22"),
        SRow("S-012", "شرکت دلتا",    "تیرآهن",      "فولاد", "فارس",    "حضوری",  "pending",    20d, 800_000_000d, "2025-03-19"),
        SRow("S-013", "شرکت اپسیلون", "گچ",          "مصالح", "تهران",   "آنلاین", "delivered", 250d, 125_000_000d, "2025-01-12"),
        SRow("S-014", "شرکت اپسیلون", "آجر نسوز",    "مصالح", "تهران",   "حضوری",  "paid",      180d, 234_000_000d, "2025-02-26"),
        SRow("S-015", "شرکت اپسیلون", "میلگرد A3",   "فولاد", "تهران",   "آنلاین", "shipped",    70d, 1_050_000_000d, "2025-03-30"),
        SRow("S-016", "شرکت آلفا",    "کاشی",        "مصالح", "تهران",   "آنلاین", "paid",      320d, 288_000_000d, "2025-04-15"),
        SRow("S-017", "شرکت بتا",     "تیرآهن",      "فولاد", "اصفهان",  "حضوری",  "delivered",  25d, 1_000_000_000d, "2025-04-21"),
        SRow("S-018", "شرکت گاما",    "گچ",          "مصالح", "خوزستان", "آنلاین", "delivered", 280d, 140_000_000d, "2025-05-02"),
        SRow("S-019", "شرکت دلتا",    "سیمان تیپ ۲", "مصالح", "فارس",    "حضوری",  "paid",      130d, 390_000_000d, "2025-05-10"),
        SRow("S-020", "شرکت اپسیلون", "سرامیک",      "مصالح", "تهران",   "آنلاین", "cancelled",  90d, 117_000_000d, "2025-05-14"),
        SRow("S-021", "شرکت آلفا",    "تیرآهن",      "فولاد", "تهران",   "حضوری",  "delivered",  35d, 1_400_000_000d, "2025-05-18"),
        SRow("S-022", "شرکت بتا",     "کاشی",        "مصالح", "اصفهان",  "آنلاین", "shipped",   260d, 234_000_000d, "2025-03-22"),
        SRow("S-023", "شرکت گاما",    "آجر نسوز",    "مصالح", "خوزستان", "حضوری",  "paid",      150d, 195_000_000d, "2025-03-27"),
        SRow("S-024", "شرکت دلتا",    "میلگرد A3",   "فولاد", "فارس",    "آنلاین", "delivered",  55d, 770_000_000d, "2025-04-02"),
        SRow("S-025", "شرکت اپسیلون", "سیمان تیپ ۲", "مصالح", "تهران",   "حضوری",  "paid",      140d, 420_000_000d, "2025-04-25"),
        SRow("S-026", "شرکت آلفا",    "گچ",          "مصالح", "تهران",   "آنلاین", "pending",   210d, 105_000_000d, "2025-05-21"),
        SRow("S-027", "شرکت بتا",     "سرامیک",      "مصالح", "اصفهان",  "حضوری",  "delivered", 175d, 227_500_000d, "2025-05-23"),
        SRow("S-028", "شرکت گاما",    "تیرآهن",      "فولاد", "خوزستان", "آنلاین", "shipped",    28d, 1_120_000_000d, "2025-05-25"),
        SRow("S-029", "شرکت دلتا",    "آجر نسوز",    "مصالح", "فارس",    "حضوری",  "paid",      220d, 286_000_000d, "2025-05-27"),
        SRow("S-030", "شرکت اپسیلون", "کاشی",        "مصالح", "تهران",   "آنلاین", "delivered", 360d, 324_000_000d, "2025-05-29"),
    ];

    private static IReadOnlyDictionary<string, object?> SRow(
        string orderId, string customerName, string product, string category,
        string province, string channel, string status,
        double qty, double amount, string orderDate) =>
        new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["orderId"]      = orderId,
            ["customerName"] = customerName,
            ["product"]      = product,
            ["category"]     = category,
            ["province"]     = province,
            ["channel"]      = channel,
            ["status"]       = status,
            ["qty"]          = qty,       // NB: column is "qty", field id is "quantity"
            ["amount"]       = amount,
            ["orderDate"]    = orderDate,
        };

    // ──────────────────────────────────────────────────────────────────────────
    // Finance dataset  (source key: "finance")
    // ──────────────────────────────────────────────────────────────────────────

    private static readonly IReadOnlyList<IReadOnlyDictionary<string, object?>> FinanceRows =
    [
        FRow("T-001", "فروش کالا",     "بازرگانی",  "درآمد", 1_240_000_000d, 22.4d,   "2025-01-31"),
        FRow("T-002", "حقوق و دستمزد", "اداری",     "هزینه",   430_000_000d,  0.0d,   "2025-01-31"),
        FRow("T-003", "فروش خدمات",   "فنی",       "درآمد",   680_000_000d, 35.0d,   "2025-02-28"),
        FRow("T-004", "اجاره",        "اداری",     "هزینه",    90_000_000d,  0.0d,   "2025-02-28"),
        FRow("T-005", "فروش کالا",    "بازرگانی",  "درآمد", 1_560_000_000d, 18.2d,   "2025-03-31"),
        FRow("T-006", "تبلیغات",      "بازاریابی", "هزینه",   210_000_000d,  0.0d,   "2025-03-31"),
        FRow("T-007", "فروش خدمات",   "فنی",       "درآمد",   720_000_000d, 41.5d,   "2025-04-30"),
        FRow("T-008", "حقوق و دستمزد","اداری",     "هزینه",   460_000_000d,  0.0d,   "2025-04-30"),
        FRow("T-009", "فروش کالا",    "بازرگانی",  "درآمد", 1_340_000_000d, 24.8d,   "2025-05-31"),
        FRowNull("T-010", "اجاره",    "اداری",     "هزینه",    90_000_000d,          "2025-05-31"),
        FRow("T-011", "فروش خدمات",   "فنی",       "درآمد",   590_000_000d, 33.3d,   "2025-01-31"),
        FRow("T-012", "تبلیغات",      "بازاریابی", "هزینه",   175_000_000d,  0.0d,   "2025-02-28"),
        FRow("T-013", "فروش کالا",    "بازرگانی",  "درآمد", 1_410_000_000d, 20.0d,   "2025-03-31"),
        FRow("T-014", "حقوق و دستمزد","اداری",     "هزینه",   480_000_000d,  0.0d,   "2025-04-30"),
        FRowNull("T-015", "فروش خدمات","فنی",      "درآمد",   650_000_000d,          "2025-05-31"),
        FRow("T-016", "اجاره",        "اداری",     "هزینه",    90_000_000d,  0.0d,   "2025-01-31"),
        FRow("T-017", "فروش کالا",    "بازرگانی",  "درآمد", 1_180_000_000d, 19.5d,   "2025-02-28"),
        FRow("T-018", "تبلیغات",      "بازاریابی", "هزینه",   230_000_000d,  0.0d,   "2025-03-31"),
        FRow("T-019", "فروش خدمات",   "فنی",       "درآمد",   770_000_000d, 38.0d,   "2025-04-30"),
        FRow("T-020", "حقوق و دستمزد","اداری",     "هزینه",   500_000_000d,  0.0d,   "2025-05-31"),
    ];

    private static IReadOnlyDictionary<string, object?> FRow(
        string txnId, string account, string costCenter, string type,
        double amount, double marginPct, string txnDate) =>
        new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["txnId"]      = txnId,
            ["account"]    = account,
            ["costCenter"] = costCenter,
            ["type"]       = type,
            ["amount"]     = amount,
            ["marginPct"]  = marginPct,
            ["txnDate"]    = txnDate,
        };

    /// <summary>Finance row with <c>marginPct = null</c> (T-010, T-015).</summary>
    private static IReadOnlyDictionary<string, object?> FRowNull(
        string txnId, string account, string costCenter, string type,
        double amount, string txnDate) =>
        new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["txnId"]      = txnId,
            ["account"]    = account,
            ["costCenter"] = costCenter,
            ["type"]       = type,
            ["amount"]     = amount,
            ["marginPct"]  = (object?)null,
            ["txnDate"]    = txnDate,
        };

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Returns the sample rows for the given source key.
    /// Accepted values: <c>"projects"</c>, <c>"sales"</c>, <c>"finance"</c>.
    /// Returns an empty list for unknown sources.
    /// </summary>
    public static IReadOnlyList<IReadOnlyDictionary<string, object?>> GetRows(string source) =>
        source switch
        {
            "projects" => ProjectRows,
            "sales"    => SalesRows,
            "finance"  => FinanceRows,
            _          => [],
        };
}
