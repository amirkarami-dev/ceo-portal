using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Infrastructure.Analytics;
using Mabhas19.Infrastructure.Analytics.Query;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Analytics;

/// <summary>
/// C# port of a representative subset of:
///   analytics-web/src/query/engine.test.ts
///   analytics-web/src/query/engine.edge.test.ts
///
/// Asserts that the C# QueryEngine produces the same deterministic numeric
/// results as the TypeScript engine for the bundled sample datasets.
///
/// DEMO CLOCK: QueryEngine.DemoToday is set to 2025-06-01 UTC in [SetUp]
/// (same as ENGINE_TODAY.value = Date.UTC(2025,5,1) in the TS tests).
/// </summary>
[TestFixture]
public class QueryEngineTests
{
    private QueryEngine _engine = null!;
    private DateTime _savedToday;

    [SetUp]
    public void SetUp()
    {
        _engine = new QueryEngine(new SemanticModelStore());
        _savedToday = QueryEngine.DemoToday;
        QueryEngine.DemoToday = new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    }

    [TearDown]
    public void TearDown()
    {
        QueryEngine.DemoToday = _savedToday;
    }

    // =========================================================================
    // Helper: run a definition and return the result
    // =========================================================================

    private async Task<ReportResultDto> Run(ReportDefinitionDto def) =>
        await _engine.ExecuteAsync(def);

    // =========================================================================
    // §5.7 — Delayed projects > 30 days by province
    // Port of engine.test.ts "runQuery — §5.7 delayed projects > 30 days by province"
    // =========================================================================

    [Test]
    public async Task DelayedProjectsByProvince_ReturnsCorrectCounts()
    {
        var def = DelayedProjectsDef();
        var r = await Run(def);

        r.Total.ShouldBe(4);
        var byProvince = r.Rows.ToDictionary(row => (string)row["province"]!);

        // تهران: 3 delayed (P-1001 dueDate=2025-03-01, P-1002 dueDate=2025-02-15, P-1003 dueDate=2025-01-20)
        ((double)byProvince["تهران"]["delayedCount"]!).ShouldBe(3);
        // اصفهان: 2 (P-1005 dueDate=2025-04-01, P-1006 dueDate=2025-01-05)
        ((double)byProvince["اصفهان"]["delayedCount"]!).ShouldBe(2);
        // خوزستان: 2 (P-1008 dueDate=2025-04-20, P-1009 dueDate=2025-03-15)
        ((double)byProvince["خوزستان"]["delayedCount"]!).ShouldBe(2);
        // فارس: 1 (P-1011 dueDate=2025-04-10)
        ((double)byProvince["فارس"]["delayedCount"]!).ShouldBe(1);
    }

    [Test]
    public async Task DelayedProjectsByProvince_ReturnsCorrectAvgDelay()
    {
        var def = DelayedProjectsDef();
        var r = await Run(def);

        var byProvince = r.Rows.ToDictionary(row => (string)row["province"]!);

        // تهران: (45+60+90)/3 = 65
        ((double)byProvince["تهران"]["avgDelay"]!).ShouldBe(65, tolerance: 1e-9);
        // اصفهان: (50+120)/2 = 85
        ((double)byProvince["اصفهان"]["avgDelay"]!).ShouldBe(85, tolerance: 1e-9);
        // خوزستان: (35+70)/2 = 52.5
        ((double)byProvince["خوزستان"]["avgDelay"]!).ShouldBe(52.5, tolerance: 1e-9);
    }

    [Test]
    public async Task DelayedProjectsByProvince_SortedDescByCount()
    {
        var def = DelayedProjectsDef();
        var r = await Run(def);

        // First row must be تهران (count=3), last must be فارس (count=1)
        ((string)r.Rows[0]["province"]!).ShouldBe("تهران");
        ((string)r.Rows[^1]["province"]!).ShouldBe("فارس");
    }

    [Test]
    public async Task DelayedProjectsByProvince_MetricColumnsTaggedIsMetricTrue()
    {
        var def = DelayedProjectsDef();
        var r = await Run(def);

        var cols = r.Columns.ToDictionary(c => c.Key);
        cols["province"].IsMetric.ShouldBe(false);
        cols["delayedCount"].IsMetric.ShouldBe(true);
        cols["avgDelay"].IsMetric.ShouldBe(true);
    }

    private static ReportDefinitionDto DelayedProjectsDef() => new()
    {
        Id      = "rpt_delayed_projects_by_province",
        Name    = "پروژه‌های معوق",
        Dataset = "projects",
        Columns =
        [
            new ReportColumnDto { Field = "province" },
        ],
        Filters =
        [
            new ReportFilterDto { Field = "status",  Operator = "neq", Value = "completed" },
            new ReportFilterDto
            {
                Field    = "dueDate",
                Operator = "lt",
                Value    = new DynamicFilterValueDto { Token = "today", OffsetDays = -30 },
                Dynamic  = true,
            },
        ],
        GroupBy =
        [
            new ReportGroupByDto { Field = "province" },
        ],
        Metrics =
        [
            new ReportMetricDto { Field = "*",         Aggregation = "count", Alias = "delayedCount" },
            new ReportMetricDto { Field = "delayDays", Aggregation = "avg",   Alias = "avgDelay"      },
        ],
        Sorting =
        [
            new ReportSortDto { Field = "delayedCount", Direction = "desc" },
        ],
    };

    // =========================================================================
    // §5.8 — Monthly revenue by province (date bucket + series)
    // Port of engine.test.ts "runQuery — §5.8 monthly revenue by province"
    // =========================================================================

    [Test]
    public async Task MonthlyRevenueByProvince_BucketsOrderDateToMonth()
    {
        var def = MonthlyRevenueDef();
        var r = await Run(def);

        // Every row's orderDate must be a YYYY-MM bucket
        foreach (var row in r.Rows)
        {
            var dateStr = row["orderDate"]?.ToString() ?? "";
            System.Text.RegularExpressions.Regex.IsMatch(dateStr, @"^\d{4}-\d{2}$")
                .ShouldBeTrue($"orderDate '{dateStr}' is not a YYYY-MM bucket");
        }
    }

    [Test]
    public async Task MonthlyRevenueByProvince_CorrectJanTehranTotal()
    {
        var def = MonthlyRevenueDef();
        var r = await Run(def);

        // Jan تهران: S-001 (360M) + S-013 (125M) = 485,000,000
        var jan = r.Rows.FirstOrDefault(row =>
            row["orderDate"]?.ToString() == "2025-01" &&
            row["province"]?.ToString() == "تهران");
        jan.ShouldNotBeNull();
        ((double)jan!["revenue"]!).ShouldBe(485_000_000, tolerance: 1e-3);
    }

    [Test]
    public async Task MonthlyRevenueByProvince_CorrectFebTehranTotal()
    {
        var def = MonthlyRevenueDef();
        var r = await Run(def);

        // Feb تهران: S-002 (880M) + S-014 (234M) = 1,114,000,000
        var feb = r.Rows.FirstOrDefault(row =>
            row["orderDate"]?.ToString() == "2025-02" &&
            row["province"]?.ToString() == "تهران");
        feb.ShouldNotBeNull();
        ((double)feb!["revenue"]!).ShouldBe(1_114_000_000, tolerance: 1e-3);
    }

    [Test]
    public async Task MonthlyRevenueByProvince_CorrectJanKhuzestanTotal()
    {
        var def = MonthlyRevenueDef();
        var r = await Run(def);

        // Jan خوزستان: S-007 (1.2B)
        var jan = r.Rows.FirstOrDefault(row =>
            row["orderDate"]?.ToString() == "2025-01" &&
            row["province"]?.ToString() == "خوزستان");
        jan.ShouldNotBeNull();
        ((double)jan!["revenue"]!).ShouldBe(1_200_000_000, tolerance: 1e-3);
    }

    [Test]
    public async Task MonthlyRevenueByProvince_SortedAscByDate()
    {
        var def = MonthlyRevenueDef();
        var r = await Run(def);

        r.Rows.ShouldNotBeEmpty();
        r.Rows[0]["orderDate"]?.ToString().ShouldBe("2025-01");
    }

    private static ReportDefinitionDto MonthlyRevenueDef() => new()
    {
        Id      = "rpt_monthly_revenue_by_province",
        Name    = "درآمد ماهانه",
        Dataset = "sales",
        Columns =
        [
            new ReportColumnDto { Field = "orderDate" },
            new ReportColumnDto { Field = "province"  },
            new ReportColumnDto { Field = "amount"    },
        ],
        Filters =
        [
            new ReportFilterDto
            {
                Field    = "orderDate",
                Operator = "gte",
                Value    = new DynamicFilterValueDto { Token = "startOfYear" },
                Dynamic  = true,
            },
        ],
        GroupBy =
        [
            new ReportGroupByDto { Field = "orderDate", DateBucket = "month" },
            new ReportGroupByDto { Field = "province" },
        ],
        Metrics =
        [
            new ReportMetricDto { Field = "amount", Aggregation = "sum", Alias = "revenue" },
        ],
        Sorting =
        [
            new ReportSortDto { Field = "orderDate", Direction = "asc",  Priority = 1 },
            new ReportSortDto { Field = "province",  Direction = "asc",  Priority = 2 },
        ],
    };

    // =========================================================================
    // §5.9 — Top 10 customers by sales (limit + post-aggregate calc)
    // Port of engine.test.ts "runQuery — §5.9 top 10 customers by sales"
    // =========================================================================

    [Test]
    public async Task TopCustomers_BetaExcludesCancelledOrders()
    {
        var def = TopCustomersDef();
        var r = await Run(def);

        // بتا paid/shipped/delivered: S-004(270M)+S-005(150M)+S-017(1000M)+S-022(234M)+S-027(227.5M) = 1,881,500,000
        var beta = r.Rows.FirstOrDefault(row => row["customerName"]?.ToString() == "شرکت بتا");
        beta.ShouldNotBeNull();
        ((double)beta!["totalSales"]!).ShouldBe(1_881_500_000, tolerance: 1e-3);
        ((double)beta["orderCount"]!).ShouldBe(5, tolerance: 1e-9);
    }

    [Test]
    public async Task TopCustomers_AvgOrderValueMatchesFormula()
    {
        var def = TopCustomersDef();
        var r = await Run(def);

        foreach (var row in r.Rows)
        {
            var total = (double)row["totalSales"]!;
            var count = (double)row["orderCount"]!;
            var avg   = (double)row["avgOrderValue"]!;
            avg.ShouldBe(total / count, tolerance: 1e-6);
        }
    }

    [Test]
    public async Task TopCustomers_SortedDescByTotalSales()
    {
        var def = TopCustomersDef();
        var r = await Run(def);

        var totals = r.Rows.Select(row => (double)row["totalSales"]!).ToList();
        totals.ShouldBe([.. totals.OrderByDescending(x => x)]);
    }

    [Test]
    public async Task TopCustomers_LimitCapsCorrctly()
    {
        // ReportDefinitionDto is a class (not a record), so rebuild with Limit=2
        var base_ = TopCustomersDef();
        var def = new ReportDefinitionDto
        {
            Id               = base_.Id,
            Name             = base_.Name,
            Dataset          = base_.Dataset,
            Columns          = base_.Columns,
            Filters          = base_.Filters,
            GroupBy          = base_.GroupBy,
            Metrics          = base_.Metrics,
            CalculatedFields = base_.CalculatedFields,
            Sorting          = base_.Sorting,
            Limit            = 2,
        };
        var r = await Run(def);

        r.Rows.Count.ShouldBe(2);
        r.Total.ShouldBe(2);
    }

    private static ReportDefinitionDto TopCustomersDef() => new()
    {
        Id      = "rpt_top10_customers_by_sales",
        Name    = "۱۰ مشتری برتر",
        Dataset = "sales",
        Columns =
        [
            new ReportColumnDto { Field = "customerName" },
            new ReportColumnDto { Field = "amount"       },
        ],
        Filters =
        [
            new ReportFilterDto
            {
                Field    = "status",
                Operator = "in",
                Value    = new[] { "paid", "shipped", "delivered" },
            },
        ],
        GroupBy =
        [
            new ReportGroupByDto { Field = "customerName" },
        ],
        Metrics =
        [
            new ReportMetricDto { Field = "amount", Aggregation = "sum",   Alias = "totalSales"  },
            new ReportMetricDto { Field = "*",      Aggregation = "count", Alias = "orderCount"  },
        ],
        CalculatedFields =
        [
            new CalculatedFieldDto
            {
                Alias      = "avgOrderValue",
                Expression = "totalSales / orderCount",
                Scope      = "aggregate",
                Type       = "number",
            },
        ],
        Sorting =
        [
            new ReportSortDto { Field = "totalSales", Direction = "desc" },
        ],
        Limit = 10,
    };

    // =========================================================================
    // Bug 1 — id→column resolution
    // Port of "Bug 1: field id→column resolution" in engine.test.ts
    // =========================================================================

    [Test]
    public async Task FieldResolution_SumArea_UsesColumnAreaM2()
    {
        // field id="area" maps to column="areaM2" — without the mapping, sum would be 0
        var def = new ReportDefinitionDto
        {
            Id      = "rpt_area_by_province",
            Name    = "مساحت",
            Dataset = "projects",
            Columns = [new ReportColumnDto { Field = "province" }],
            GroupBy = [new ReportGroupByDto { Field = "province" }],
            Metrics = [new ReportMetricDto { Field = "area", Aggregation = "sum", Alias = "totalArea" }],
        };

        var r = await Run(def);
        var byProvince = r.Rows.ToDictionary(row => (string)row["province"]!);

        // تهران: 8200+5400+3100+420 = 17120
        ((double)byProvince["تهران"]["totalArea"]!).ShouldBe(17120, tolerance: 1e-9);
        // اصفهان: 9600+12000+2200 = 23800
        ((double)byProvince["اصفهان"]["totalArea"]!).ShouldBe(23800, tolerance: 1e-9);
        // خوزستان: 15000+6800+4000 = 25800
        ((double)byProvince["خوزستان"]["totalArea"]!).ShouldBe(25800, tolerance: 1e-9);
        // فارس: 7200+5000 = 12200
        ((double)byProvince["فارس"]["totalArea"]!).ShouldBe(12200, tolerance: 1e-9);
    }

    [Test]
    public async Task FieldResolution_SumQuantity_UsesColumnQty()
    {
        // field id="quantity" maps to column="qty" — without the mapping, sum would be 0
        var def = new ReportDefinitionDto
        {
            Id      = "rpt_qty_by_province",
            Name    = "تعداد",
            Dataset = "sales",
            Columns = [new ReportColumnDto { Field = "province" }],
            GroupBy = [new ReportGroupByDto { Field = "province" }],
            Metrics = [new ReportMetricDto { Field = "quantity", Aggregation = "sum", Alias = "totalQty" }],
        };

        var r = await Run(def);
        var byProvince = r.Rows.ToDictionary(row => (string)row["province"]!);

        // تهران: 120+40+200+250+180+70+320+210+35+90+140+360 = 2015
        ((double)byProvince["تهران"]["totalQty"]!).ShouldBe(2015, tolerance: 1e-9);
        // اصفهان: 90+300+50+25+260+175 = 900
        ((double)byProvince["اصفهان"]["totalQty"]!).ShouldBe(900, tolerance: 1e-9);
        // خوزستان: 30+60+110+280+150+28 = 658
        ((double)byProvince["خوزستان"]["totalQty"]!).ShouldBe(658, tolerance: 1e-9);
        // فارس: 500+400+20+130+55+220 = 1325
        ((double)byProvince["فارس"]["totalQty"]!).ShouldBe(1325, tolerance: 1e-9);
    }

    // =========================================================================
    // Bug 3 — unknown field reference throws
    // Port of "Bug 3: unknown field reference throws" in engine.test.ts
    // =========================================================================

    [Test]
    public void UnknownField_InMetric_Throws()
    {
        var def = new ReportDefinitionDto
        {
            Id      = "bad",
            Name    = "bad",
            Dataset = "projects",
            Columns = [new ReportColumnDto { Field = "province" }],
            GroupBy = [new ReportGroupByDto { Field = "province" }],
            Metrics = [new ReportMetricDto { Field = "nonExistentField", Aggregation = "sum", Alias = "bad" }],
        };

        Should.Throw<InvalidOperationException>(async () => await Run(def))
            .Message.ShouldContain("Unknown field");
    }

    [Test]
    public void UnknownField_InFilter_Throws()
    {
        var def = new ReportDefinitionDto
        {
            Id      = "bad",
            Name    = "bad",
            Dataset = "projects",
            Columns = [new ReportColumnDto { Field = "province" }],
            Filters = [new ReportFilterDto { Field = "ghostField", Operator = "eq", Value = "x" }],
        };

        Should.Throw<InvalidOperationException>(async () => await Run(def))
            .Message.ShouldContain("Unknown field");
    }

    [Test]
    public void UnknownField_InGroupBy_Throws()
    {
        var def = new ReportDefinitionDto
        {
            Id      = "bad",
            Name    = "bad",
            Dataset = "projects",
            Columns = [new ReportColumnDto { Field = "province" }],
            GroupBy = [new ReportGroupByDto { Field = "doesNotExist" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count", Alias = "cnt" }],
        };

        Should.Throw<InvalidOperationException>(async () => await Run(def))
            .Message.ShouldContain("Unknown field");
    }

    // =========================================================================
    // Edge cases — port of engine.edge.test.ts
    // =========================================================================

    [Test]
    public async Task Edge_EmptyResult_ZeroRowsColumnsStillResolved()
    {
        var def = new ReportDefinitionDto
        {
            Id      = "e1",
            Name    = "x",
            Dataset = "finance",
            Columns =
            [
                new ReportColumnDto { Field = "account" },
                new ReportColumnDto { Field = "amount"  },
            ],
            Filters =
            [
                new ReportFilterDto { Field = "account", Operator = "eq", Value = "__does_not_exist__" },
            ],
            GroupBy = [new ReportGroupByDto { Field = "account" }],
            Metrics = [new ReportMetricDto { Field = "amount", Aggregation = "sum", Alias = "total" }],
        };

        var r = await Run(def);

        r.Total.ShouldBe(0);
        r.Rows.ShouldBeEmpty();
        r.Columns.Select(c => c.Key).ShouldContain("account");
        r.Columns.Select(c => c.Key).ShouldContain("total");
    }

    [Test]
    public async Task Edge_AllNullMeasure_AvgOverNullsIsZero_CountStillCountsRows()
    {
        // T-010 and T-015 have marginPct = null
        var def = new ReportDefinitionDto
        {
            Id      = "e3",
            Name    = "x",
            Dataset = "finance",
            Columns = [new ReportColumnDto { Field = "amount" }],
            Filters =
            [
                new ReportFilterDto { Field = "marginPct", Operator = "isNull" },
            ],
            Metrics =
            [
                new ReportMetricDto { Field = "marginPct", Aggregation = "avg",   Alias = "avgMargin" },
                new ReportMetricDto { Field = "*",         Aggregation = "count", Alias = "n"         },
            ],
        };

        var r = await Run(def);

        ((double)r.Rows[0]["n"]!).ShouldBe(2);        // T-010, T-015
        ((double)r.Rows[0]["avgMargin"]!).ShouldBe(0); // no numeric values → 0
    }

    [Test]
    public async Task Edge_CountDistinct_AccountsAndCostCenters()
    {
        var def = new ReportDefinitionDto
        {
            Id      = "e4",
            Name    = "x",
            Dataset = "finance",
            Columns = [new ReportColumnDto { Field = "amount" }],
            Metrics =
            [
                new ReportMetricDto { Field = "account",    Aggregation = "countDistinct", Alias = "accounts" },
                new ReportMetricDto { Field = "costCenter", Aggregation = "countDistinct", Alias = "centers"  },
            ],
        };

        var r = await Run(def);

        ((double)r.Rows[0]["accounts"]!).ShouldBe(5); // فروش کالا / حقوق و دستمزد / فروش خدمات / اجاره / تبلیغات
        ((double)r.Rows[0]["centers"]!).ShouldBe(4);  // بازرگانی / اداری / فنی / بازاریابی
    }

    // =========================================================================
    // EvalExpression unit tests
    // Port of "evalExpression (safe, post-aggregate)" in engine.test.ts
    // =========================================================================

    [Test]
    public void EvalExpression_ArithmeticOverScope()
    {
        var scope = new Dictionary<string, double?> { ["totalSales"] = 100, ["orderCount"] = 4 };
        var result = QueryEngine.EvalExpression("totalSales / orderCount", scope);
        result.ShouldNotBeNull();
        result!.Value.ShouldBe(25, tolerance: 1e-9);
    }

    [Test]
    public void EvalExpression_NestedParens()
    {
        var scope = new Dictionary<string, double?> { ["revenue"] = 200, ["cost"] = 50 };
        // (revenue - cost) / revenue * 100 = 150/200*100 = 75
        var result = QueryEngine.EvalExpression("(revenue - cost) / revenue * 100", scope);
        result.ShouldNotBeNull();
        result!.Value.ShouldBe(75, tolerance: 1e-9);
    }

    [Test]
    public void EvalExpression_DivisionByZero_ReturnsNull()
    {
        var scope = new Dictionary<string, double?> { ["a"] = 10, ["b"] = 0 };
        QueryEngine.EvalExpression("a / b", scope).ShouldBeNull();
    }

    [Test]
    public void EvalExpression_UnsafeToken_Throws()
    {
        Should.Throw<InvalidOperationException>(() =>
            QueryEngine.EvalExpression("process.exit", new Dictionary<string, double?>()));
    }

    // =========================================================================
    // ResolveDynamicToken unit tests
    // =========================================================================

    [Test]
    public void ResolveDynamicToken_Today_ReturnsCorrectDate()
    {
        QueryEngine.ResolveDynamicToken("today", null, null).ShouldBe("2025-06-01");
    }

    [Test]
    public void ResolveDynamicToken_TodayMinus30Days_ReturnsCorrectDate()
    {
        QueryEngine.ResolveDynamicToken("today", null, -30).ShouldBe("2025-05-02");
    }

    [Test]
    public void ResolveDynamicToken_StartOfYear_ReturnsCorrectDate()
    {
        QueryEngine.ResolveDynamicToken("startOfYear", null, null).ShouldBe("2025-01-01");
    }

    [Test]
    public void ResolveDynamicToken_StartOfMonth_ReturnsCorrectDate()
    {
        QueryEngine.ResolveDynamicToken("startOfMonth", null, null).ShouldBe("2025-06-01");
    }

    // =========================================================================
    // DateBucketKey unit tests
    // =========================================================================

    [Test]
    public void DateBucketKey_Month()
    {
        QueryEngine.DateBucketKey("2025-03-11", "month").ShouldBe("2025-03");
    }

    [Test]
    public void DateBucketKey_Quarter()
    {
        QueryEngine.DateBucketKey("2025-03-11", "quarter").ShouldBe("2025-Q1");
        QueryEngine.DateBucketKey("2025-11-02", "quarter").ShouldBe("2025-Q4");
    }

    [Test]
    public void DateBucketKey_Year()
    {
        QueryEngine.DateBucketKey("2025-03-11", "year").ShouldBe("2025");
    }

    [Test]
    public void DateBucketKey_Day()
    {
        QueryEngine.DateBucketKey("2025-03-11", "day").ShouldBe("2025-03-11");
    }
}
