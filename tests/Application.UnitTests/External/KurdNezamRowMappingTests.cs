using System.Data;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Infrastructure.External;
using Microsoft.Extensions.Logging.Abstractions;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.External;

/// <summary>
/// Turning one row of <c>WebS_GetEngineerInfo</c> into an <see cref="EngineerInfo"/>.
/// </summary>
/// <remarks>
/// <para>
/// This exists because of a real outage. The mapper used to read <c>CodeMeli</c>, then call
/// <c>ReadAsync</c> to check for a second row — and for the normal single-row answer that returns
/// false while leaving the reader positioned <b>past the end</b>. Every field read after it threw
/// «Invalid attempt to read when no data is present», the catch reported <c>Unavailable</c>, and the
/// welfare page rendered that as «این حساب، حساب مهندس نیست» to real engineers who were members.
/// </para>
/// <para>
/// No fake reader is needed: <c>DataTable.CreateDataReader()</c> is a real
/// <see cref="System.Data.Common.DbDataReader"/>, and it reproduces the exact behaviour — read after
/// the reader is exhausted and it throws, same as SQL Server.
/// </para>
/// <para>
/// <b>The discipline is deliberately not asserted here.</b> It does not come from this stored
/// procedure at all: <c>CodeOzveyat</c> leads to <c>tblDW_OzviatInfo.Reshte</c>, which needs a
/// database. What this file pins is that <c>CodeOzveyat</c> survives the mapping — without it the
/// discipline can never be resolved, and a discipline-restricted election would refuse everyone.
/// </para>
/// </remarks>
public class KurdNezamRowMappingTests
{
    private const string Code = "3732087395";

    /// <summary>The columns the mapper reads, in the shape the real SP returns them.</summary>
    private static DataTable Table()
    {
        var t = new DataTable();
        foreach (var c in new[]
                 {
                     "CodeMeli", "CodeOzveyat", "Nam", "NameKhanevadegi", "FirstName", "LastName",
                     "Mob", "Vazeyat", "PrvExp", "MadrakNam",
                 })
        {
            t.Columns.Add(c, typeof(string));
        }

        return t;
    }

    /// <summary>A row shaped like the real one — real values, trailing spaces and all.</summary>
    private static void AddRow(DataTable t, string code = Code) =>
        t.Rows.Add(code, "499", "تست", "سیستم", "تست", "سیستم",
            "09120000000", "0", "1405/06/28  ", "کارشناسی پیوسته");

    private static async Task<KurdNezamEngineerDirectory.EngineerRow> MapFirstRowAsync(
        DataTable t, string expected = Code)
    {
        using var r = t.CreateDataReader();
        r.Read().ShouldBeTrue("the fixture must have a first row");
        return await KurdNezamEngineerDirectory.MapAsync(r, expected, NullLogger.Instance, default);
    }

    // ── the regression ───────────────────────────────────────────────────────

    [Test]
    public async Task A_single_row_maps_every_field_and_does_not_throw()
    {
        var t = Table();
        AddRow(t);

        var row = await MapFirstRowAsync(t);

        // Before the fix this was Unavailable, because reading Vazeyat after the multi-row check
        // threw and the catch swallowed it.
        row.Outcome.ShouldBe(DirectoryOutcome.Found);
        row.Engineer.ShouldNotBeNull();

        row.Engineer!.NationalCode.ShouldBe(Code);
        row.Engineer.FirstName.ShouldBe("تست");
        row.Engineer.LastName.ShouldBe("سیستم");
        row.Engineer.Mobile.ShouldBe("09120000000");
        row.Engineer.MembershipStatus.ShouldBe(0);
        row.Engineer.EducationLevel.ShouldBe("کارشناسی پیوسته");

        // Trimmed, and NOT parsed as a date — 1405 would be read as a Gregorian year.
        row.Engineer.LicenceExpiryJalali.ShouldBe("1405/06/28");
    }

    [Test]
    public async Task Vazeyat_zero_is_the_active_membership_value()
    {
        var t = Table();
        AddRow(t);

        // 0 = active. The whole eligibility check hangs off this being read at all — and before the
        // fix it was the FIRST field read after the reader had been advanced, so it always threw.
        (await MapFirstRowAsync(t)).Engineer!.MembershipStatus.ShouldBe(0);
    }

    // ── the discipline has to be resolvable afterwards ───────────────────────

    [Test]
    public async Task CodeOzveyat_survives_because_it_is_the_only_route_to_the_discipline()
    {
        var t = Table();
        AddRow(t);

        var row = await MapFirstRowAsync(t);

        // CodeOzveyat -> tblDW_OzviatInfo.Ozviat -> Reshte (1 معماری … 7 ترافیک). Lose this and a
        // discipline-restricted election compares an empty string against "4" and refuses every
        // mechanical engineer from their own election.
        row.CodeOzveyat.ShouldBe("499");

        // Left empty on purpose at this stage; the caller fills it from the warehouse table.
        row.Engineer!.ReshteCode.ShouldBeEmpty();
    }

    // ── the guards the ordering must not break ───────────────────────────────

    [Test]
    public async Task Two_rows_for_one_national_code_are_refused()
    {
        var t = Table();
        AddRow(t);
        AddRow(t);

        // A person holding two membership rows could otherwise answer as someone else. During an
        // election that would consume the wrong voter's one-vote slot.
        var row = await MapFirstRowAsync(t);

        row.Outcome.ShouldBe(DirectoryOutcome.Unavailable);
        row.Engineer.ShouldBeNull();
    }

    [Test]
    public async Task An_answer_about_a_different_person_is_refused()
    {
        var t = Table();
        AddRow(t, "1111111111");

        var row = await MapFirstRowAsync(t, expected: Code);

        row.Outcome.ShouldBe(DirectoryOutcome.Unavailable);
        row.Engineer.ShouldBeNull();
    }

    [Test]
    public async Task A_blank_national_code_in_the_answer_is_not_found()
    {
        var t = Table();
        AddRow(t, "   ");

        (await MapFirstRowAsync(t)).Outcome.ShouldBe(DirectoryOutcome.NotFound);
    }

    [Test]
    public async Task A_non_numeric_membership_status_fails_closed_rather_than_defaulting_to_active()
    {
        var t = Table();
        t.Rows.Add(Code, "499", "تست", "سیستم", "", "", "09120000000", "نامعلوم", "1405/06/28", "کارشناسی");

        // null, not 0. IsActiveMember treats null as NOT active, so an unreadable status keeps
        // somebody out rather than letting a suspended member through.
        (await MapFirstRowAsync(t)).Engineer!.MembershipStatus.ShouldBeNull();
    }
}
