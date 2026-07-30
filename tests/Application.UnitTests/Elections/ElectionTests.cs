using Mabhas19.Application.Common;
using Mabhas19.Application.Elections;
using Mabhas19.Domain.Elections;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Phase, freeze and validation rules. These are pure — no database — so they run in milliseconds and
/// cover the logic that decides whether a running election can be reshaped underneath its voters.
/// </summary>
public class ElectionPhaseTests
{
    private static Election Published(DateTimeOffset opens, DateTimeOffset closes) => new()
    {
        Status = ElectionStatus.Published,
        OpensAtUtc = opens,
        ClosesAtUtc = closes
    };

    private static readonly DateTimeOffset Noon = new(2026, 7, 23, 12, 0, 0, TimeSpan.Zero);

    [Test]
    public void Draft_is_Draft_regardless_of_the_clock()
    {
        var e = new Election { Status = ElectionStatus.Draft, OpensAtUtc = Noon.AddHours(-5), ClosesAtUtc = Noon.AddHours(5) };
        e.PhaseAt(Noon).ShouldBe(ElectionPhase.Draft);
    }

    [Test]
    public void Cancelled_beats_everything()
    {
        var e = Published(Noon.AddHours(-1), Noon.AddHours(1));
        e.Status = ElectionStatus.Cancelled;
        e.PhaseAt(Noon).ShouldBe(ElectionPhase.Cancelled);
    }

    [Test]
    public void Before_the_window_is_NotYetOpen()
        => Published(Noon.AddHours(1), Noon.AddHours(2)).PhaseAt(Noon).ShouldBe(ElectionPhase.NotYetOpen);

    [Test]
    public void Inside_the_window_is_Open()
        => Published(Noon.AddHours(-1), Noon.AddHours(1)).PhaseAt(Noon).ShouldBe(ElectionPhase.Open);

    [Test]
    public void Opens_at_exactly_now_is_already_Open()
        => Published(Noon, Noon.AddHours(1)).PhaseAt(Noon).ShouldBe(ElectionPhase.Open);

    [Test]
    public void Closes_at_exactly_now_is_already_Closed()
    {
        // ClosesAtUtc is an EXCLUSIVE bound: a ballot at the closing instant is too late. If this
        // ever flips to inclusive, votes can land after the published end time.
        Published(Noon.AddHours(-1), Noon).PhaseAt(Noon).ShouldBe(ElectionPhase.Closed);
    }

    [Test]
    public void Closed_becomes_ResultsAvailable_only_once_tallied()
    {
        var e = Published(Noon.AddHours(-2), Noon.AddHours(-1));
        e.PhaseAt(Noon).ShouldBe(ElectionPhase.Closed);

        e.TalliedAt = Noon;
        e.PhaseAt(Noon).ShouldBe(ElectionPhase.ResultsAvailable);
    }
}

public class ElectionFreezeTests
{
    private static readonly DateTimeOffset Noon = new(2026, 7, 23, 12, 0, 0, TimeSpan.Zero);

    [Test]
    public void A_draft_is_never_frozen_even_with_ballots()
    {
        // A draft cannot legitimately have ballots; if it somehow does, Draft still means editable.
        var e = new Election { Status = ElectionStatus.Draft, OpensAtUtc = Noon.AddHours(-1) };
        e.IsFrozen(Noon, anyBallots: true).ShouldBeFalse();
    }

    [Test]
    public void Published_and_not_yet_open_is_editable()
    {
        var e = new Election { Status = ElectionStatus.Published, OpensAtUtc = Noon.AddHours(1) };
        e.IsFrozen(Noon, anyBallots: false).ShouldBeFalse();
    }

    [Test]
    public void Published_and_open_is_frozen()
    {
        var e = new Election { Status = ElectionStatus.Published, OpensAtUtc = Noon.AddHours(-1) };
        e.IsFrozen(Noon, anyBallots: false).ShouldBeTrue();
    }

    [Test]
    public void A_ballot_freezes_it_even_before_the_window_opens()
    {
        // Belt and braces: a ballot before OpensAtUtc could only happen through a bug, but editing is
        // still the wrong thing to allow once a vote exists.
        var e = new Election { Status = ElectionStatus.Published, OpensAtUtc = Noon.AddHours(1) };
        e.IsFrozen(Noon, anyBallots: true).ShouldBeTrue();
    }
}

public class IranTimeTests
{
    [Test]
    public void A_local_window_resolves_to_the_right_instants()
    {
        // 09:00 Tehran is 05:30 UTC — the offset is +3:30, not a whole number of hours.
        var opens = IranTime.ToInstant(new DateOnly(2026, 7, 23), new TimeOnly(9, 0));
        opens.UtcDateTime.ShouldBe(new DateTime(2026, 7, 23, 5, 30, 0, DateTimeKind.Utc));
    }

    [Test]
    public void Iran_today_is_ahead_of_UTC_today_in_the_early_hours()
    {
        // 21:30 UTC is already 01:00 the next day in Tehran. A licence-expiry check against UTC's
        // date would be wrong for these 3.5 hours every single day.
        var lateUtc = new DateTimeOffset(2026, 7, 23, 21, 30, 0, TimeSpan.Zero);

        IranTime.Today(lateUtc).ShouldBe(new DateOnly(2026, 7, 24));
        DateOnly.FromDateTime(lateUtc.UtcDateTime).ShouldBe(new DateOnly(2026, 7, 23));
    }
}

public class ElectionInputValidatorTests
{
    private static ElectionInput Valid(
        int maxSelections = 1,
        int candidates = 2,
        ElectionEligibility mode = ElectionEligibility.AllMembers,
        string date = "1405/05/01",
        int endHour = 17) => new(
        Title: "انتخاب هیئت رئیسه واحد گاز",
        Description: null,
        EligibilityMode: mode,
        DateJalali: date,
        StartTime: new TimeOnly(9, 0),
        EndTime: new TimeOnly(endHour, 0),
        MaxSelections: maxSelections,
        EligibleReshtes: mode == ElectionEligibility.ByReshte
            ? [new EligibleReshteInput("4", "مکانیک")]
            : [],
        Candidates: Enumerable.Range(1, candidates)
            .Select(n => new CandidateInput($"کاندیدا {n}", null, "4", "کارشناسی", null, n))
            .ToList());

    private static IReadOnlyList<string> Errors(ElectionInput input)
        => new ElectionInputValidator().Validate(input).Errors.Select(e => e.PropertyName).ToList();

    [Test]
    public void A_well_formed_election_passes()
        => new ElectionInputValidator().Validate(Valid()).IsValid.ShouldBeTrue();

    [Test]
    public void An_election_with_no_candidates_is_refused()
        => Errors(Valid(candidates: 0)).ShouldContain(nameof(ElectionInput.Candidates));

    [Test]
    public void Picking_more_candidates_than_exist_is_refused()
        => Errors(Valid(maxSelections: 3, candidates: 2)).ShouldContain(nameof(ElectionInput.MaxSelections));

    [Test]
    public void An_end_before_the_start_is_refused()
        => Errors(Valid(endHour: 8)).ShouldContain(nameof(ElectionInput.EndTime));

    [Test]
    public void A_gregorian_date_in_the_jalali_field_is_refused()
    {
        // "2026/07/23" parses as Jalali year 2026, which is outside the accepted 1300-1500 range.
        // Without this the election would silently land ~600 years away.
        Errors(Valid(date: "2026/07/23")).ShouldContain(nameof(ElectionInput.DateJalali));
    }

    [Test]
    public void ByReshte_with_no_disciplines_is_refused()
    {
        // Otherwise it silently means "nobody may vote" and the window is wasted.
        var input = Valid(mode: ElectionEligibility.ByReshte) with { EligibleReshtes = [] };
        Errors(input).ShouldContain(nameof(ElectionInput.EligibleReshtes));
    }

    [Test]
    public void Persian_digits_in_the_date_are_accepted()
        => new ElectionInputValidator().Validate(Valid(date: "۱۴۰۵/۰۵/۰۱")).IsValid.ShouldBeTrue();
}
