using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Elections;

namespace Mabhas19.Application.Elections;

/// <summary>Why a person may or may not vote. One reason per failure, so the UI can say which.</summary>
public enum VoterStatus
{
    Eligible = 0,

    /// <summary>The کد ملی is not in the org's membership directory.</summary>
    NotAMember,

    /// <summary>The directory could not be reached. Distinct from NotAMember on purpose — see below.</summary>
    DirectoryUnavailable,

    /// <summary><c>Vazeyat</c> is not 0.</summary>
    NotActive,

    /// <summary><c>PrvExp</c> is in the past, or unreadable.</summary>
    LicenceExpired,

    /// <summary>Their رشته is not in the election's allowed set.</summary>
    WrongReshte,

    AlreadyVoted,
    NotOpenYet,
    Closed,
    Cancelled,
    NotPublished
}

/// <summary>
/// The outcome of the eligibility check, with a Persian message ready to show.
/// </summary>
/// <remarks>
/// A refused voter must be told WHICH condition failed, or they simply conclude the system is broken
/// and phone the office. <see cref="Message"/> is safe to return to the caller;
/// <see cref="EngineerInfo"/> is present only when the lookup succeeded and must never be serialised
/// back to a voter.
/// </remarks>
public sealed record VoterCheck(VoterStatus Status, string Message, EngineerInfo? Engineer = null)
{
    public bool IsEligible => Status == VoterStatus.Eligible;
}

/// <summary>
/// Decides whether one person may vote in one election. Pure apart from the directory call, so every
/// branch is unit-testable without a database.
/// </summary>
public static class VoterEligibility
{
    /// <summary>
    /// Runs the election-level checks (published, window, cancelled). These need no directory call, so
    /// they run first — no point asking the org's SQL Server about someone when voting is closed.
    /// </summary>
    public static VoterCheck CheckElection(Election election, DateTimeOffset now) =>
        election.PhaseAt(now) switch
        {
            ElectionPhase.Cancelled => new(VoterStatus.Cancelled, "این انتخابات لغو شده است"),
            ElectionPhase.Draft => new(VoterStatus.NotPublished, "این انتخابات هنوز منتشر نشده است"),
            ElectionPhase.NotYetOpen => new(VoterStatus.NotOpenYet,
                $"رأی‌گیری از ساعت {election.StartTime:HH\\:mm} روز {election.DateJalali} آغاز می‌شود"),
            ElectionPhase.Closed or ElectionPhase.ResultsAvailable => new(VoterStatus.Closed,
                "زمان رأی‌گیری این انتخابات به پایان رسیده است"),
            _ => new(VoterStatus.Eligible, string.Empty)
        };

    /// <summary>
    /// Runs the person-level checks against the org record: member, active, licence valid, discipline.
    /// </summary>
    /// <param name="lookupFailed">
    /// True when the directory threw or was unconfigured, as opposed to genuinely not knowing the code.
    /// <c>GOTCHAS.md</c> records «این کد ملی یافت نشد» once being shown for a SQL parameter bug — so a
    /// failure must NOT reuse the not-found wording, or the next outage looks like mass ineligibility.
    /// </param>
    public static VoterCheck CheckVoter(
        Election election,
        EngineerInfo? engineer,
        DateOnly todayInIran,
        bool lookupFailed = false)
    {
        if (lookupFailed)
        {
            return new(VoterStatus.DirectoryUnavailable,
                "ارتباط با سامانه نظام مهندسی برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید");
        }

        if (engineer is null)
        {
            return new(VoterStatus.NotAMember, "این کد ملی در سامانه نظام مهندسی یافت نشد");
        }

        if (!engineer.IsActiveMember)
        {
            return new(VoterStatus.NotActive, "عضویت شما فعال نیست", engineer);
        }

        // Licence expiry. Unreadable or missing FAILS CLOSED: treating a blank date as valid would let
        // anyone whose record is incomplete vote, which is exactly the case a challenger would find.
        var expiry = JalaliDate.Parse(engineer.LicenceExpiryJalali);
        if (expiry is null || expiry.Value < todayInIran)
        {
            return new(VoterStatus.LicenceExpired, "اعتبار پروانهٔ شما به پایان رسیده است", engineer);
        }

        if (election.EligibilityMode == ElectionEligibility.ByReshte && !MatchesReshte(election, engineer))
        {
            return new(VoterStatus.WrongReshte,
                "این انتخابات ویژهٔ رشته‌های دیگری است و شما مجاز به رأی دادن نیستید", engineer);
        }

        return new(VoterStatus.Eligible, string.Empty, engineer);
    }

    /// <summary>
    /// Discipline match. Normalises Persian/Arabic digits and compares as text, never as a number —
    /// the org's code list is not guaranteed to stay numeric, and a leading zero must not be lost.
    /// </summary>
    private static bool MatchesReshte(Election election, EngineerInfo engineer)
    {
        var mine = JalaliDate.NormalizeDigits(engineer.ReshteCode ?? string.Empty).Trim();

        // An engineer with no رشته on record cannot match a discipline-restricted election. Failing
        // closed again: an empty code matching everything would silently open the ballot to everyone.
        if (mine.Length == 0)
        {
            return false;
        }

        return election.EligibleReshtes.Any(r =>
            string.Equals(
                JalaliDate.NormalizeDigits(r.ReshteCode).Trim(),
                mine,
                StringComparison.OrdinalIgnoreCase));
    }
}
