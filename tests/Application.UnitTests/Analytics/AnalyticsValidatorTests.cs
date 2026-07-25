using System.Text.Json.Nodes;
using Mabhas19.Application.Analytics.AiProviders.Commands.UpsertAiProvider;
using Mabhas19.Application.Analytics.Dashboards.Commands.SaveDashboard;
using Mabhas19.Application.Analytics.Reports.Commands.SaveReport;
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
}
