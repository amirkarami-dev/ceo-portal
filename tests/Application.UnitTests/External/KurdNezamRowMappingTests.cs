using System.Data;
using Mabhas19.Application.Common;
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
/// </remarks>
public class KurdNezamRowMappingTests
{
    private const string Code = "3732087395";

    /// <summary>The ten columns the directory reads, in the shape the real SP returns them.</summary>
    private static DataTable Table()
    {
        var t = new DataTable();
        foreach (var c in new[]
                 {
                     "CodeMeli", "Nam", "NameKhanevadegi", "FirstName", "LastName",
                     // BOTH discipline columns, because telling them apart is the point: Reshte is
                     // the 1–7 code the election matches on; ReshteID is a رشته-گرایش id that
                     // matches none of them.
                     "Reshte", "ReshteID",
                     "Mob", "Vazeyat", "PrvExp", "MadrakNam",
                 })
        {
            t.Columns.Add(c, typeof(string));
        }

        return t;
    }

    /// <summary>A row shaped like the real one — real values, trailing spaces and all.</summary>
    private static void AddRow(DataTable t, string code = Code) =>
        t.Rows.Add(code, "تست", "سیستم", "تست", "سیستم",
            // The live row: Reshte=3 (عمران) alongside ReshteID=3000.
            "3", "3000",
            "09120000000", "0", "1405/06/28  ", "کارشناسی پیوسته");

    private static async Task<DirectoryResult> MapFirstRowAsync(DataTable t, string expected = Code)
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

        var result = await MapFirstRowAsync(t);

        // Before the fix this was Unavailable, because reading Vazeyat after the multi-row check
        // threw and the catch swallowed it.
        result.Outcome.ShouldBe(DirectoryOutcome.Found);
        result.Engineer.ShouldNotBeNull();

        result.Engineer!.NationalCode.ShouldBe(Code);
        result.Engineer.FirstName.ShouldBe("تست");
        result.Engineer.LastName.ShouldBe("سیستم");
        // Reshte, not ReshteID. If this ever reads "3000" again, a discipline-restricted election
        // silently refuses every voter — see the class remarks.
        result.Engineer.ReshteCode.ShouldBe("3");
        result.Engineer.Mobile.ShouldBe("09120000000");
        result.Engineer.MembershipStatus.ShouldBe(0);
        result.Engineer.EducationLevel.ShouldBe("کارشناسی پیوسته");

        // Trimmed, and NOT parsed as a date — 1405 would be read as a Gregorian year.
        result.Engineer.LicenceExpiryJalali.ShouldBe("1405/06/28");
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

    // ── the guards the ordering must not break ───────────────────────────────

    [Test]
    public async Task Two_rows_for_one_national_code_are_refused()
    {
        var t = Table();
        AddRow(t);
        AddRow(t);

        // A person holding two membership rows could otherwise answer as someone else. During an
        // election that would consume the wrong voter's one-vote slot.
        var result = await MapFirstRowAsync(t);

        result.Outcome.ShouldBe(DirectoryOutcome.Unavailable);
        result.Engineer.ShouldBeNull();
    }

    [Test]
    public async Task An_answer_about_a_different_person_is_refused()
    {
        var t = Table();
        AddRow(t, "1111111111");

        var result = await MapFirstRowAsync(t, expected: Code);

        result.Outcome.ShouldBe(DirectoryOutcome.Unavailable);
        result.Engineer.ShouldBeNull();
    }

    [Test]
    public async Task A_blank_national_code_in_the_answer_is_not_found()
    {
        var t = Table();
        AddRow(t, "   ");

        (await MapFirstRowAsync(t)).Outcome.ShouldBe(DirectoryOutcome.NotFound);
    }

    [Test]
    public async Task The_discipline_code_is_the_one_the_election_matches_on()
    {
        var t = Table();
        // مکانیک — the discipline «انتخاب هیئت رئیسه واحد گاز» restricts to.
        t.Rows.Add(Code, "تست", "سیستم", "", "", "4", "4000", "09120000000", "0", "1405/06/28", "کارشناسی");

        var code = (await MapFirstRowAsync(t)).Engineer!.ReshteCode;

        // ElectionEligibleReshte stores "4" for مکانیک, and eligibility is an exact comparison.
        // "4000" here would refuse every mechanical engineer from their own election.
        code.ShouldBe("4");
        ReshteNames.Describe(code).ShouldBe("مکانیک");
    }

    [Test]
    public async Task A_non_numeric_membership_status_fails_closed_rather_than_defaulting_to_active()
    {
        var t = Table();
        t.Rows.Add(Code, "تست", "سیستم", "", "", "3", "3000", "09120000000", "نامعلوم", "1405/06/28", "کارشناسی");

        // null, not 0. IsActiveMember treats null as NOT active, so an unreadable status keeps
        // somebody out rather than letting a suspended member through.
        (await MapFirstRowAsync(t)).Engineer!.MembershipStatus.ShouldBeNull();
    }
}
