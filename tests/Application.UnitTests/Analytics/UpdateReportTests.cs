using System.Text.Json;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.Reports.Commands.UpdateReport;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Analytics;

/// <summary>
/// Validation and JSON round-trip for the report update path.
///
/// The round-trip tests matter more than they look. A report is persisted by serialising
/// <see cref="ReportDefinitionDto"/> into <c>DefinitionJson</c> (SaveReport/UpdateReport) and read
/// back by deserialising the same type (GetReports). Anything the DTO does not declare is dropped on
/// BOTH legs, silently — no error, no warning. Label overrides stored in a field the DTO did not
/// carry would work perfectly against the mock API, which keeps whole objects in localStorage, and
/// vanish in production.
/// </summary>
[TestFixture]
public class UpdateReportTests
{
    private static ReportDefinitionDto Roundtrip(ReportDefinitionDto def) =>
        JsonSerializer.Deserialize<ReportDefinitionDto>(JsonSerializer.Serialize(def))!;

    // -----------------------------------------------------------------------
    // UpdateReportCommandValidator
    // -----------------------------------------------------------------------

    private static UpdateReportCommand Cmd(
        int id = 1,
        string name = "درآمد ماهانه",
        string dataset = "sales",
        string? visibility = null) =>
        new(id, new ReportDefinitionDto { Name = name, Dataset = dataset }, visibility);

    [Test]
    public void UpdateReport_ValidCommand_PassesValidation()
    {
        new UpdateReportCommandValidator().Validate(Cmd()).IsValid.ShouldBeTrue();
    }

    [Test]
    public void UpdateReport_IdMustBeARealRow()
    {
        new UpdateReportCommandValidator().Validate(Cmd(id: 0)).IsValid.ShouldBeFalse();
    }

    /// <summary>
    /// The definition's name becomes the AnalyticsReport.Name column, so an empty one would blank the
    /// title in the library list as well as in the viewer.
    /// </summary>
    [Test]
    public void UpdateReport_EmptyName_FailsValidation()
    {
        new UpdateReportCommandValidator().Validate(Cmd(name: "")).IsValid.ShouldBeFalse();
    }

    [Test]
    public void UpdateReport_UnknownVisibility_FailsValidation()
    {
        new UpdateReportCommandValidator().Validate(Cmd(visibility: "public")).IsValid.ShouldBeFalse();
    }

    [TestCase("private")]
    [TestCase("tenant")]
    public void UpdateReport_KnownVisibility_PassesValidation(string visibility)
    {
        new UpdateReportCommandValidator().Validate(Cmd(visibility: visibility)).IsValid.ShouldBeTrue();
    }

    /// <summary>Absent visibility means "leave the current scope alone", not "invalid".</summary>
    [Test]
    public void UpdateReport_NoVisibility_PassesValidation()
    {
        new UpdateReportCommandValidator().Validate(Cmd(visibility: null)).IsValid.ShouldBeTrue();
    }

    // -----------------------------------------------------------------------
    // Label overrides survive the trip to the database and back
    // -----------------------------------------------------------------------

    [Test]
    public void TitleOverrides_SurviveTheRoundTrip()
    {
        var def = new ReportDefinitionDto
        {
            Name = "Monthly revenue",
            Dataset = "sales",
            TitleOverrides = new LocalizedLabelDto { FaIR = "درآمد ماهانه", EnUS = "Monthly income" }
        };

        var back = Roundtrip(def);

        back.TitleOverrides.ShouldNotBeNull();
        back.TitleOverrides!.FaIR.ShouldBe("درآمد ماهانه");
        back.TitleOverrides.EnUS.ShouldBe("Monthly income");
    }

    [Test]
    public void LabelOverrides_SurviveTheRoundTrip_KeyedByColumn()
    {
        var def = new ReportDefinitionDto
        {
            Name = "x",
            Dataset = "sales",
            LabelOverrides = new Dictionary<string, LocalizedLabelDto>
            {
                ["sum_amount"] = new() { FaIR = "فروش خالص", EnUS = "Net sales" },
                ["province"] = new() { FaIR = "استان" }
            }
        };

        var back = Roundtrip(def);

        back.LabelOverrides.ShouldNotBeNull();
        back.LabelOverrides!.Count.ShouldBe(2);
        back.LabelOverrides["sum_amount"].FaIR.ShouldBe("فروش خالص");
        back.LabelOverrides["sum_amount"].EnUS.ShouldBe("Net sales");
        back.LabelOverrides["province"].FaIR.ShouldBe("استان");
    }

    /// <summary>
    /// One language only is the normal case, not an edge case: a Persian user renames a chart and the
    /// English reader must keep the automatically composed name rather than being shown Persian. That
    /// only works if the absent side stays null instead of being coerced to "".
    /// </summary>
    [Test]
    public void OneLanguageOnly_LeavesTheOtherNull()
    {
        var def = new ReportDefinitionDto
        {
            Name = "x",
            Dataset = "sales",
            LabelOverrides = new Dictionary<string, LocalizedLabelDto>
            {
                ["sum_amount"] = new() { FaIR = "فروش خالص" }
            }
        };

        Roundtrip(def).LabelOverrides!["sum_amount"].EnUS.ShouldBeNull();
    }

    /// <summary>The JSON keys are the locale ids the frontend uses, not C# property names.</summary>
    [Test]
    public void TheJsonKeysAreLocaleIds()
    {
        var json = JsonSerializer.Serialize(new ReportDefinitionDto
        {
            Name = "x",
            Dataset = "sales",
            TitleOverrides = new LocalizedLabelDto { FaIR = "الف", EnUS = "A" }
        });

        json.ShouldContain("\"titleOverrides\"");
        json.ShouldContain("\"fa-IR\"");
        json.ShouldContain("\"en-US\"");
        json.ShouldNotContain("FaIR");
        json.ShouldNotContain("EnUS");
    }

    /// <summary>
    /// A report saved before this feature existed has no overrides at all. It must still read back,
    /// with nulls rather than an exception — every report in the database today is in this shape.
    /// </summary>
    [Test]
    public void ADefinitionWithNoOverrides_StillReadsBack()
    {
        var back = JsonSerializer.Deserialize<ReportDefinitionDto>(
            """{"id":"rpt_x","name":"x","dataset":"sales","columns":[],"metrics":[]}""")!;

        back.Name.ShouldBe("x");
        back.TitleOverrides.ShouldBeNull();
        back.LabelOverrides.ShouldBeNull();
    }
}
