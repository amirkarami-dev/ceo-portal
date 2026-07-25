using System.Text.Json;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Infrastructure.Analytics.Ai;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Analytics;

/// <summary>
/// Unit tests for the pure helpers in <see cref="ArvanReportAiService"/>
/// and the static <see cref="SemanticModelStore"/> catalogue.
/// No network calls are made.
/// </summary>
[TestFixture]
public class ArvanReportAiServiceTests
{
    // -----------------------------------------------------------------------
    // Real captured content sample from the ArvanCloud AI gateway
    // -----------------------------------------------------------------------

    private const string RealAiContent =
        "<think>\n" +
        "The user is asking...\n" +
        "</think>\n\n" +
        "{\"id\":\"top_customers_by_sales\"," +
        "\"name\":\"Top 10 Customers by Total Sales\"," +
        "\"dataset\":\"sales\"," +
        "\"columns\":[{\"field\":\"customerName\"}]," +
        "\"filters\":[]," +
        "\"groupBy\":[{\"field\":\"customerName\"}]," +
        "\"metrics\":[{\"field\":\"amount\",\"aggregation\":\"sum\",\"alias\":\"total_sales\"}]," +
        "\"sorting\":[{\"field\":\"total_sales\",\"direction\":\"desc\"}]," +
        "\"limit\":10}";

    // -----------------------------------------------------------------------
    // ExtractJson tests
    // -----------------------------------------------------------------------

    [Test]
    public void ExtractJson_WithThinkBlock_ReturnsCleanJson()
    {
        var json = ArvanReportAiService.ExtractJson(RealAiContent);

        json.ShouldStartWith("{");
        json.ShouldEndWith("}");
        json.ShouldNotContain("<think>");
        json.ShouldNotContain("</think>");
    }

    [Test]
    public void ExtractJson_ParsedDto_HasCorrectShape()
    {
        var json = ArvanReportAiService.ExtractJson(RealAiContent);

        var dto = JsonSerializer.Deserialize<ReportDefinitionDto>(json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        dto.ShouldNotBeNull();
        dto!.Dataset.ShouldBe("sales");
        dto.Limit.ShouldBe(10);
        dto.Metrics.Count.ShouldBe(1);
        dto.Metrics[0].Field.ShouldBe("amount");
        dto.Metrics[0].Aggregation.ShouldBe("sum");
        dto.Metrics[0].Alias.ShouldBe("total_sales");
        dto.Sorting.Count.ShouldBe(1);
        dto.Sorting[0].Direction.ShouldBe("desc");
    }

    [Test]
    public void ExtractJson_WithoutThinkBlock_ReturnsJsonDirectly()
    {
        var raw = "{\"id\":\"test\",\"name\":\"Test\",\"dataset\":\"sales\",\"columns\":[],\"filters\":[],\"groupBy\":[],\"metrics\":[],\"sorting\":[]}";

        var json = ArvanReportAiService.ExtractJson(raw);

        json.ShouldBe(raw);
    }

    [Test]
    public void ExtractJson_WithCodeFence_StripsMarkdown()
    {
        var raw = "```json\n{\"id\":\"x\",\"name\":\"X\",\"dataset\":\"sales\",\"columns\":[],\"filters\":[],\"groupBy\":[],\"metrics\":[],\"sorting\":[]}\n```";

        var json = ArvanReportAiService.ExtractJson(raw);

        json.ShouldStartWith("{");
        json.ShouldEndWith("}");
    }

    [Test]
    public void ExtractJson_WithThinkAndCodeFence_ReturnsCleanJson()
    {
        var content = "<think>\nreasoning\n</think>\n\n```json\n{\"id\":\"x\",\"name\":\"X\",\"dataset\":\"sales\",\"columns\":[],\"filters\":[],\"groupBy\":[],\"metrics\":[],\"sorting\":[]}\n```";

        var json = ArvanReportAiService.ExtractJson(content);

        json.ShouldStartWith("{");
        json.ShouldEndWith("}");
        json.ShouldNotContain("```");
    }

    // -----------------------------------------------------------------------
    // BuildSystemPrompt tests
    // -----------------------------------------------------------------------

    [Test]
    public void BuildSystemPrompt_ContainsSourceKey()
    {
        var model = BuildSalesModel();

        var prompt = ArvanReportAiService.BuildSystemPrompt(model);

        prompt.ShouldContain("sales");
    }

    [Test]
    public void BuildSystemPrompt_ContainsAllFieldIds()
    {
        var model = BuildSalesModel();

        var prompt = ArvanReportAiService.BuildSystemPrompt(model);

        foreach (var field in model.Fields)
            prompt.ShouldContain(field.Id);
    }

    [Test]
    public void BuildSystemPrompt_ContainsNeverSqlInstruction()
    {
        var model = BuildSalesModel();

        var prompt = ArvanReportAiService.BuildSystemPrompt(model);

        prompt.ShouldContain("NEVER");
        prompt.ToUpperInvariant().ShouldContain("SQL");
    }

    [Test]
    public void BuildSystemPrompt_ContainsModelKey()
    {
        var model = BuildSalesModel();

        var prompt = ArvanReportAiService.BuildSystemPrompt(model);

        prompt.ShouldContain(model.ModelKey);
    }

    // -----------------------------------------------------------------------
    // SemanticModelStore catalogue tests
    // -----------------------------------------------------------------------

    [Test]
    public async Task SemanticModelStore_GetAllAsync_ReturnsThreeModels()
    {
        var store = new Mabhas19.Infrastructure.Analytics.SemanticModelStore();

        var models = await store.GetAllAsync();

        models.Count.ShouldBe(3);
    }

    [Test]
    public async Task SemanticModelStore_GetAllAsync_AllModelsHaveNonEmptyFields()
    {
        var store = new Mabhas19.Infrastructure.Analytics.SemanticModelStore();

        var models = await store.GetAllAsync();

        foreach (var model in models)
        {
            model.ModelKey.ShouldNotBeNullOrWhiteSpace();
            model.Source.ShouldNotBeNullOrWhiteSpace();
            model.Fields.ShouldNotBeEmpty($"Model '{model.ModelKey}' has no fields");
        }
    }

    [Test]
    public async Task SemanticModelStore_GetByIdAsync_ReturnsCorrectModel()
    {
        var store = new Mabhas19.Infrastructure.Analytics.SemanticModelStore();

        var model = await store.GetByIdAsync("model-sales");

        model.ShouldNotBeNull();
        model!.Source.ShouldBe("sales");
        model.Fields.ShouldContain(f => f.Id == "amount");
    }

    [Test]
    public async Task SemanticModelStore_GetByIdAsync_UnknownKey_ReturnsNull()
    {
        var store = new Mabhas19.Infrastructure.Analytics.SemanticModelStore();

        var model = await store.GetByIdAsync("model-nonexistent");

        model.ShouldBeNull();
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private static SemanticModelDto BuildSalesModel() => new()
    {
        ModelKey = "model-sales",
        Name     = "Sales",
        Source   = "sales",
        Fields   =
        [
            new SemanticFieldDto { Id = "customerName", Name = "Customer", Type = "string", Role = "dimension" },
            new SemanticFieldDto { Id = "amount",       Name = "Revenue",  Type = "number", Role = "measure"   },
            new SemanticFieldDto { Id = "orderDate",    Name = "Order Date",Type = "date",  Role = "date"      },
        ],
    };
}
