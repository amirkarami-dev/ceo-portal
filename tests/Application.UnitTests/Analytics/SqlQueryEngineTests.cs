using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Infrastructure.Analytics.Sql;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Analytics;

/// <summary>
/// Unit tests for <see cref="SqlQueryEngine.BuildSql"/> (the pure SQL builder)
/// and the <see cref="KurdNezamSemanticModelStore"/> catalogue.
/// No database or network calls — BuildSql is tested directly.
/// </summary>
[TestFixture]
public class SqlQueryEngineTests
{
    // =========================================================================
    // KurdNezamSemanticModelStore catalogue tests
    // =========================================================================

    [Test]
    public async Task SemanticModelStore_ReturnsTwoModels()
    {
        var store = new KurdNezamSemanticModelStore();
        var models = await store.GetAllAsync();

        models.Count.ShouldBe(2);
    }

    [Test]
    public async Task SemanticModelStore_EachModelHasNonEmptyFields()
    {
        var store = new KurdNezamSemanticModelStore();
        var models = await store.GetAllAsync();

        foreach (var model in models)
        {
            model.Fields.Count.ShouldBeGreaterThan(0,
                $"Model '{model.ModelKey}' should have at least one field");
        }
    }

    [Test]
    public async Task SemanticModelStore_ResolvesBySource_OzInfo()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");

        model.ShouldNotBeNull();
        model!.ModelKey.ShouldBe("model-oz-info");
        model.Fields.ShouldContain(f => f.Id == "Ozviat");
        model.Fields.ShouldContain(f => f.Id == "PayeT");
        model.Fields.ShouldContain(f => f.Id == "Reshte");
        model.Fields.ShouldContain(f => f.Id == "ActiveInErja");
    }

    [Test]
    public async Task SemanticModelStore_ResolvesBySource_EngineerProjects()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");

        model.ShouldNotBeNull();
        model!.ModelKey.ShouldBe("model-engineer-projects");
        model.Fields.ShouldContain(f => f.Id == "ProjectNo");
        model.Fields.ShouldContain(f => f.Id == "Meter");
        model.Fields.ShouldContain(f => f.Id == "RegDate");
    }

    [Test]
    public async Task SemanticModelStore_ResolvesByModelKey()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetByIdAsync("model-oz-info");

        model.ShouldNotBeNull();
        model!.Source.ShouldBe("oz_info");
    }

    [Test]
    public async Task SemanticModelStore_FieldDescriptions_CarryCodeDictionaries()
    {
        // The dictionaries are what let the AI map "مهندسین برق" to Reshte = 5 —
        // losing them silently degrades every prompt, so they are pinned here.
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");

        model!.Fields.First(f => f.Id == "Reshte").Description.ShouldNotBeNull();
        model.Fields.First(f => f.Id == "Reshte").Description!.ShouldContain("معماری");
        model.Fields.First(f => f.Id == "PayeT").Description!.ShouldContain("ارشد");
        model.Fields.First(f => f.Id == "TypDftr").Description!.ShouldContain("آزمایشگاه");
    }

    // =========================================================================
    // BuildSql — count members grouped by Reshte, top 10
    // =========================================================================

    [Test]
    public async Task BuildSql_CountByReshte_ContainsExpectedFragments()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "Reshte" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count", Alias = "member_count" }],
            Sorting = [new ReportSortDto { Field = "member_count", Direction = "desc" }],
            Limit   = 10,
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out var parameters);

        sql.ShouldContain("FROM [tblDW_OzviatInfo]");
        sql.ShouldContain("GROUP BY [Reshte]");
        sql.ShouldContain("COUNT(*)");
        sql.ShouldContain("member_count");

        // OFFSET/FETCH with parameters — no raw value interpolation
        sql.ShouldContain("OFFSET");
        sql.ShouldContain("FETCH NEXT");
        sql.ShouldContain("@limit");
        sql.ShouldContain("@offset");

        parameters.ShouldContain(p => p.Name == "@limit" && (int)p.Value! == 10);
        parameters.ShouldContain(p => p.Name == "@offset" && (int)p.Value! == 0);

        // No raw "10" interpolated directly into the SQL (it should be a parameter reference)
        sql.ShouldNotContain(" 10 ");
    }

    // =========================================================================
    // BuildSql — filter ActiveInErja > 100 → parameterized @p0 with value 100
    // =========================================================================

    [Test]
    public async Task BuildSql_FilterActiveInErjaGt100_IsParameterized()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            Filters = [new ReportFilterDto { Field = "ActiveInErja", Operator = "gt", Value = 100 }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out var parameters);

        sql.ShouldContain("WHERE");
        sql.ShouldContain("[ActiveInErja] > @p0");
        sql.ShouldNotContain("WHERE [ActiveInErja] > 100");

        parameters.ShouldContain(p => p.Name == "@p0");
        var p0 = parameters.First(p => p.Name == "@p0");
        Convert.ToInt64(p0.Value).ShouldBe(100L);
    }

    // =========================================================================
    // BuildSql — unknown fields → throws (whitelist)
    // =========================================================================

    [Test]
    public async Task BuildSql_UnknownField_ThrowsInvalidOperationException()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            Filters = [new ReportFilterDto { Field = "DROP_TABLE", Operator = "eq", Value = "x" }],
        };

        Should.Throw<InvalidOperationException>(() =>
            SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out _));
    }

    [Test]
    public async Task BuildSql_UnknownGroupByField_ThrowsInvalidOperationException()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "NonExistentField" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        Should.Throw<InvalidOperationException>(() =>
            SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out _));
    }

    [Test]
    public async Task BuildSql_UnknownMetricField_ThrowsInvalidOperationException()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            Metrics = [new ReportMetricDto { Field = "InjectField", Aggregation = "sum" }],
        };

        Should.Throw<InvalidOperationException>(() =>
            SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out _));
    }

    // =========================================================================
    // BuildSql — contains filter → LIKE %value% as parameter (not interpolated)
    // =========================================================================

    [Test]
    public async Task BuildSql_ContainsFilter_UsesLikeWithParameter()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "engineer_projects",
            Filters = [new ReportFilterDto { Field = "ProjectNo", Operator = "contains", Value = "140" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_EngineerProjectInfo", out var parameters);

        sql.ShouldContain("[ProjectNo] LIKE @p0");
        // The % wrapping should be IN the parameter value, not in the SQL string
        sql.ShouldNotContain("%140%");

        var p0 = parameters.First(p => p.Name == "@p0");
        p0.Value.ShouldBe("%140%");
    }

    // =========================================================================
    // BuildSql — IN filter → multiple parameters
    // =========================================================================

    [Test]
    public async Task BuildSql_InFilter_GeneratesMultipleParameters()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            Filters =
            [
                new ReportFilterDto
                {
                    // Reshte codes: 1=معماری, 3=عمران, 5=برق
                    Field    = "Reshte",
                    Operator = "in",
                    Value    = new List<object> { "1", "3", "5" },
                },
            ],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out var parameters);

        sql.ShouldContain("[Reshte] IN (@p0, @p1, @p2)");
        parameters.ShouldContain(p => p.Name == "@p0");
        parameters.ShouldContain(p => p.Name == "@p1");
        parameters.ShouldContain(p => p.Name == "@p2");
    }

    // =========================================================================
    // BuildSql — Jalali dateBucket (year / month) on RegDate
    // =========================================================================

    [Test]
    public async Task BuildSql_JalaliDateBucketYear_UsesLeft4()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "engineer_projects",
            GroupBy = [new ReportGroupByDto { Field = "RegDate", DateBucket = "year" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_EngineerProjectInfo", out _);

        sql.ShouldContain("LEFT([RegDate], 4)");
        sql.ShouldContain("GROUP BY LEFT([RegDate], 4)");
    }

    [Test]
    public async Task BuildSql_JalaliDateBucketMonth_UsesLeft7()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "engineer_projects",
            GroupBy = [new ReportGroupByDto { Field = "RegDate", DateBucket = "month" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_EngineerProjectInfo", out _);

        sql.ShouldContain("LEFT([RegDate], 7)");
    }

    // =========================================================================
    // BuildSql — oz_info grouped count (TypDftr)
    // =========================================================================

    [Test]
    public async Task BuildSql_OzInfo_CountGroupedByTypDftr()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "TypDftr" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count", Alias = "member_count" }],
            Limit   = 50,
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out var parameters);

        sql.ShouldContain("FROM [tblDW_OzviatInfo]");
        sql.ShouldContain("GROUP BY [TypDftr]");
        sql.ShouldContain("COUNT(*)");
        sql.ShouldContain("member_count");
        parameters.ShouldContain(p => p.Name == "@limit" && (int)p.Value! == 50);
    }

    // =========================================================================
    // BuildSql — engineer_projects SUM(Meter) by CityId
    // =========================================================================

    [Test]
    public async Task BuildSql_EngineerProjects_SumMeterByCity()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "engineer_projects",
            GroupBy = [new ReportGroupByDto { Field = "CityId" }],
            Metrics = [new ReportMetricDto { Field = "Meter", Aggregation = "sum", Alias = "total_meter" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_EngineerProjectInfo", out _);

        sql.ShouldContain("FROM [tblDW_EngineerProjectInfo]");
        sql.ShouldContain("SUM([Meter])");
        sql.ShouldContain("total_meter");
        sql.ShouldContain("GROUP BY [CityId]");
    }

    // =========================================================================
    // BuildSql — between filter → two parameters
    // =========================================================================

    [Test]
    public async Task BuildSql_BetweenFilter_TwoParameters()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            Filters =
            [
                new ReportFilterDto
                {
                    Field    = "ActiveInErja",
                    Operator = "between",
                    Value    = 5,
                    Value2   = 20,
                },
            ],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_OzviatInfo", out var parameters);

        sql.ShouldContain("[ActiveInErja] BETWEEN @p0 AND @p1");
        parameters.ShouldContain(p => p.Name == "@p0");
        parameters.ShouldContain(p => p.Name == "@p1");
    }

    // =========================================================================
    // BuildSql — no raw user values in SQL string for eq filter
    // =========================================================================

    [Test]
    public async Task BuildSql_EqFilter_NoValueInterpolatedInSql()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("engineer_projects");
        model.ShouldNotBeNull();

        const string sensitiveValue = "'; DROP TABLE tblDW_EngineerProjectInfo; --";

        var def = new ReportDefinitionDto
        {
            Dataset = "engineer_projects",
            Filters = [new ReportFilterDto { Field = "ProjectNo", Operator = "eq", Value = sensitiveValue }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model!, "tblDW_EngineerProjectInfo", out var parameters);

        // The injection string must NOT appear in the SQL
        sql.ShouldNotContain(sensitiveValue);
        // It should be a parameter
        sql.ShouldContain("[ProjectNo] = @p0");
        parameters.First(p => p.Name == "@p0").Value.ShouldBe(sensitiveValue);
    }

    // =========================================================================
    // SourceToTable whitelist sanity
    // =========================================================================

    [Test]
    public void SourceToTable_ContainsTwoExpectedMappings()
    {
        KurdNezamSemanticModelStore.SourceToTable.Count.ShouldBe(2);
        KurdNezamSemanticModelStore.SourceToTable["oz_info"].ShouldBe("tblDW_OzviatInfo");
        KurdNezamSemanticModelStore.SourceToTable["engineer_projects"].ShouldBe("tblDW_EngineerProjectInfo");
    }

    // =========================================================================
    // BuildSql — code → label lookup join. The live KurdNezam catalogue has no
    // lookup fields today, so an INLINE model keeps the join generation covered.
    // =========================================================================

    private static SemanticModelDto LookupModel() => new()
    {
        ModelKey = "model-test-lookup",
        Name     = "lookup-test",
        Source   = "oz_info",
        Fields   =
        [
            new SemanticFieldDto { Id = "Typ", Name = "نوع", Type = "string", Role = "dimension",
                LookupTable = "tblMap_TypMohandes", LookupKeyColumn = "Id", LookupNameColumn = "Onvan" },
            new SemanticFieldDto { Id = "CityId", Name = "شهر", Type = "number", Role = "dimension" },
            new SemanticFieldDto { Id = "Meter", Name = "متراژ", Type = "number", Role = "measure" },
        ],
    };

    [Test]
    public void BuildSql_GroupByLookupField_EmitsLeftJoinAndProjectsLabel()
    {
        var model = LookupModel();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "Typ" }],
            Metrics = [new ReportMetricDto { Field = "*", Aggregation = "count", Alias = "c" }],
            Sorting = [new ReportSortDto { Field = "c", Direction = "desc" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model, "tblDW_OzviatInfo", out _);

        // LEFT JOIN the lookup keyed on the base-table code column
        sql.ShouldContain("LEFT JOIN [tblMap_TypMohandes] AS [lk_Typ] ON [tblDW_OzviatInfo].[Typ] = [lk_Typ].[Id]");
        // Project + group by the label column (not the raw code)
        sql.ShouldContain("[lk_Typ].[Onvan] AS [Typ]");
        sql.ShouldContain("GROUP BY [lk_Typ].[Onvan]");
        sql.ShouldContain("COUNT(*) AS [c]");
    }

    [Test]
    public void BuildSql_LookupJoin_QualifiesBaseTableMeasureColumn()
    {
        var model = LookupModel();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "Typ" }],
            Metrics = [new ReportMetricDto { Field = "Meter", Aggregation = "sum", Alias = "m" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model, "tblDW_OzviatInfo", out _);

        // When a join is present, base-table columns are table-qualified to avoid ambiguity.
        sql.ShouldContain("SUM([tblDW_OzviatInfo].[Meter])");
        sql.ShouldContain("LEFT JOIN [tblMap_TypMohandes]");
    }

    [Test]
    public void BuildSql_NoLookupField_KeepsColumnsUnqualified()
    {
        var model = LookupModel();

        var def = new ReportDefinitionDto
        {
            Dataset = "oz_info",
            GroupBy = [new ReportGroupByDto { Field = "CityId" }],
            Metrics = [new ReportMetricDto { Field = "Meter", Aggregation = "sum", Alias = "m" }],
        };

        var sql = SqlQueryEngine.BuildSql(def, model, "tblDW_OzviatInfo", out _);

        // No lookup in the def → no join, columns stay bare (existing behaviour preserved).
        sql.ShouldNotContain("LEFT JOIN");
        sql.ShouldContain("SUM([Meter])");
        sql.ShouldContain("GROUP BY [CityId]");
    }

    // =========================================================================
    // ApplyValueLabels — dictionary codes become display labels in RESULT rows
    // =========================================================================

    [Test]
    public async Task ApplyValueLabels_TranslatesCodes_AcrossSqlValueShapes()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var rows = new List<Dictionary<string, object?>>
        {
            new()
            {
                ["Reshte"] = "5",          // nvarchar code
                ["PayeT"]  = (short)-1,    // smallint code (-1 = ارشد)
                ["IsHogh"] = true,         // bit arrives as bool
                ["Ozviat"] = 5317,         // no dictionary → untouched
                ["member_count"] = 42,     // metric alias → untouched
            },
        };

        SqlQueryEngine.ApplyValueLabels(rows, model!);

        rows[0]["Reshte"].ShouldBe("برق");
        rows[0]["PayeT"].ShouldBe("ارشد");
        rows[0]["IsHogh"].ShouldBe("حقوقی");
        rows[0]["Ozviat"].ShouldBe(5317);
        rows[0]["member_count"].ShouldBe(42);
    }

    [Test]
    public async Task ApplyValueLabels_UnknownCodeOrNull_PassesThrough()
    {
        var store = new KurdNezamSemanticModelStore();
        var model = await store.GetBySourceAsync("oz_info");
        model.ShouldNotBeNull();

        var rows = new List<Dictionary<string, object?>>
        {
            new() { ["Reshte"] = "99", ["PayeT"] = null },
        };

        SqlQueryEngine.ApplyValueLabels(rows, model!);

        // A code outside the dictionary must stay visible as-is, never become blank.
        rows[0]["Reshte"].ShouldBe("99");
        rows[0]["PayeT"].ShouldBeNull();
    }
}
