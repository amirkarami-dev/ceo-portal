using System.Text.Json;
using System.Text.Json.Nodes;
using Mabhas19.Application.Analytics.AiProviders.Commands.UpsertAiProvider;
using Mabhas19.Application.Analytics.Dashboards.Commands.SaveDashboard;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.Reports.Commands.SaveReport;
using Mabhas19.Application.Analytics.Reports.Queries.GetEngineerQuota;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Analytics;

/// <summary>
/// Pure-mapping / validation unit tests for the new Analytics validators.
/// No DB or HTTP calls.
/// </summary>
[TestFixture]
public class AnalyticsValidatorTests
{
    // -----------------------------------------------------------------------
    // SaveDashboardCommand
    // -----------------------------------------------------------------------

    [Test]
    public void SaveDashboard_ValidCommand_PassesValidation()
    {
        var validator = new SaveDashboardCommandValidator();
        var cmd = new SaveDashboardCommand("My Dashboard", [], []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeTrue();
    }

    [Test]
    public void SaveDashboard_EmptyName_FailsValidation()
    {
        var validator = new SaveDashboardCommandValidator();
        var cmd = new SaveDashboardCommand(string.Empty, [], []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(SaveDashboardCommand.Name));
    }

    [Test]
    public void SaveDashboard_NameTooLong_FailsValidation()
    {
        var validator = new SaveDashboardCommandValidator();
        var cmd = new SaveDashboardCommand(new string('a', 301), [], []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(SaveDashboardCommand.Name));
    }

    // -----------------------------------------------------------------------
    // UpsertAiProviderCommand
    // -----------------------------------------------------------------------

    [Test]
    public void UpsertAiProvider_ValidCommand_PassesValidation()
    {
        var validator = new UpsertAiProviderCommandValidator();
        var cmd = new UpsertAiProviderCommand("openai", true, []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeTrue();
    }

    [Test]
    [TestCase("openai")]
    [TestCase("azure")]
    [TestCase("anthropic")]
    [TestCase("arvan")]
    [TestCase("custom")]
    public void UpsertAiProvider_AllowedTypes_PassValidation(string type)
    {
        var validator = new UpsertAiProviderCommandValidator();
        var cmd = new UpsertAiProviderCommand(type, true, []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeTrue($"Type '{type}' should be valid");
    }

    [Test]
    public void UpsertAiProvider_UnknownType_FailsValidation()
    {
        var validator = new UpsertAiProviderCommandValidator();
        var cmd = new UpsertAiProviderCommand("unknown-llm", true, []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(UpsertAiProviderCommand.Type));
    }

    [Test]
    public void UpsertAiProvider_EmptyType_FailsValidation()
    {
        var validator = new UpsertAiProviderCommandValidator();
        var cmd = new UpsertAiProviderCommand(string.Empty, true, []);

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(UpsertAiProviderCommand.Type));
    }

    // -----------------------------------------------------------------------
    // SaveReportCommand (existing — confirm still passes)
    // -----------------------------------------------------------------------

    [Test]
    public void SaveReport_ValidCommand_PassesValidation()
    {
        var validator = new SaveReportCommandValidator();
        var cmd = new SaveReportCommand(
            new Mabhas19.Application.Analytics.Reports.ReportDefinitionDto { Dataset = "sales" },
            "My Report",
            "private");

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeTrue();
    }

    [Test]
    public void SaveReport_InvalidVisibility_FailsValidation()
    {
        var validator = new SaveReportCommandValidator();
        var cmd = new SaveReportCommand(
            new Mabhas19.Application.Analytics.Reports.ReportDefinitionDto { Dataset = "sales" },
            "My Report",
            "public"); // invalid

        var result = validator.Validate(cmd);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(SaveReportCommand.Visibility));
    }

    // -----------------------------------------------------------------------
    // GetEngineerQuotaQuery — the two ids reach a stored procedure
    // -----------------------------------------------------------------------

    [Test]
    public void GetEngineerQuota_ValidIds_PassesValidation()
    {
        var validator = new GetEngineerQuotaQueryValidator();

        // Bijar, mechanical — the pair the report opens on.
        var result = validator.Validate(new GetEngineerQuotaQuery(25, 4));

        result.IsValid.ShouldBeTrue();
    }

    [Test]
    public void GetEngineerQuota_ZeroOrNegativeIds_FailValidation()
    {
        var validator = new GetEngineerQuotaQueryValidator();

        validator.Validate(new GetEngineerQuotaQuery(0, 4)).IsValid.ShouldBeFalse();
        validator.Validate(new GetEngineerQuotaQuery(25, 0)).IsValid.ShouldBeFalse();
        validator.Validate(new GetEngineerQuotaQuery(-1, -1)).IsValid.ShouldBeFalse();
    }

    [Test]
    public void GetEngineerQuota_UnknownButPositiveIds_StillPass()
    {
        // Deliberately not an allow-list of the nine cities that exist today: those ids live in the
        // database, and a new city must not return 400 from a service that does not know about
        // cities. The procedure answers for an id it does not recognise; that is its job, not this
        // validator's.
        var validator = new GetEngineerQuotaQueryValidator();

        validator.Validate(new GetEngineerQuotaQuery(999, 99)).IsValid.ShouldBeTrue();
    }

    // -----------------------------------------------------------------------
    // ReportDefinitionDto.Presentation — custom views round-trip, others do not
    // -----------------------------------------------------------------------

    private static ReportDefinitionDto RoundTrip(string json)
    {
        // Exactly what the API does: bind the request, then store
        // JsonSerializer.Serialize(definition) and read it back.
        var bound = JsonSerializer.Deserialize<ReportDefinitionDto>(json)!;
        return JsonSerializer.Deserialize<ReportDefinitionDto>(JsonSerializer.Serialize(bound))!;
    }

    [Test]
    public void Presentation_CustomView_SurvivesTheRoundTrip()
    {
        // Without this a custom report cannot exist in production at all: presentation was not on the
        // DTO, so it was dropped on save and the report came back as an ordinary one.
        const string json = """
        {
          "name": "quota",
          "dataset": "oz_info",
          "presentation": { "views": [ {
              "type": "chart", "library": "custom", "component": "EngineerQuota",
              "options": { "cityId": 25, "reshte": 4 }
          } ] }
        }
        """;

        var result = RoundTrip(json);

        result.Presentation.ShouldNotBeNull();
        result.Presentation!.Views.Count.ShouldBe(1);
        result.Presentation.Views[0].Component.ShouldBe("EngineerQuota");
    }

    [Test]
    public void Presentation_CarriesTheCustomReportsParameters()
    {
        // The whole point of keeping presentation: without the view's "options" the report loads
        // with no city and no discipline.
        const string json = """
        {
          "name": "quota", "dataset": "oz_info",
          "presentation": { "views": [ {
              "type": "chart", "library": "custom", "component": "EngineerQuota",
              "options": { "cityId": 25, "reshte": 4 }
          } ] }
        }
        """;

        var options = RoundTrip(json).Presentation!.Views[0].Options;

        options.ShouldNotBeNull();
        options!.Value.GetProperty("cityId").GetInt32().ShouldBe(25);
        options.Value.GetProperty("reshte").GetInt32().ShouldBe(4);
    }

    [Test]
    public void Presentation_DropsViewsThatAreNotCustom()
    {
        // ReportViewer PREFERS a non-empty presentation.views over chooseView, so persisting the view
        // auto-viz happened to pick would freeze it for every report anyone re-saves.
        const string json = """
        {
          "name": "revenue", "dataset": "sales",
          "presentation": { "views": [
            { "type": "chart", "library": "echarts", "component": "BarChart" },
            { "type": "table", "library": "antd", "component": "Table" }
          ] }
        }
        """;

        RoundTrip(json).Presentation!.Views.ShouldBeEmpty();
    }

    [Test]
    public void Presentation_KeepsOnlyTheCustomViewFromAMixedList()
    {
        const string json = """
        {
          "name": "mixed", "dataset": "oz_info",
          "presentation": { "views": [
            { "type": "table", "library": "antd", "component": "Table" },
            { "type": "chart", "library": "custom", "component": "EngineerQuota" }
          ] }
        }
        """;

        var views = RoundTrip(json).Presentation!.Views;

        views.Count.ShouldBe(1);
        views[0].Library.ShouldBe("custom");
    }

    [Test]
    public void Presentation_AbsentStaysAbsent()
    {
        // Every ordinary report. Null presentation means the frontend derives its views, unchanged.
        RoundTrip("""{ "name": "plain", "dataset": "sales" }""").Presentation.ShouldBeNull();
    }
}
