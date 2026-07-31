using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Mabhas19.Domain.Rooms;

namespace Mabhas19.Application.Rooms;

/// <summary>Why a join was refused. <see cref="None"/> means it was allowed.</summary>
/// <remarks>
/// One reason per gate, because "no" without a reason is the thing attendees complain about. The
/// landing page shows the same sentences before anyone presses anything, so a person waiting for a
/// meeting to open is never guessing.
/// </remarks>
public enum JoinDenyReason
{
    None = 0,

    /// <summary>No such link, or the meeting was deleted. Deliberately the same answer for both.</summary>
    NotFound = 1,

    /// <summary>The meeting exists but an administrator closed it.</summary>
    Closed = 2,

    /// <summary>A private link, and nobody is signed in. The caller should sign in and come back.</summary>
    NeedsSignIn = 3,

    /// <summary>Signed in, but not on the invite list.</summary>
    NotInvited = 4,

    /// <summary>Too early. The countdown is still running.</summary>
    NotOpenYet = 5,

    /// <summary>The room is at capacity.</summary>
    Full = 6,

    /// <summary>A public link and no name typed.</summary>
    NeedsName = 7,

    /// <summary>The media server is not configured, so no token could be trusted anyway.</summary>
    Unavailable = 8
}

/// <summary>
/// Who gets into a meeting, and why not.
/// </summary>
/// <remarks>
/// <para>
/// No database, no clock, no HTTP — everything the decision needs is a parameter. That is what lets the
/// member path and the link path share one implementation, the same reason <c>IBallotCaster</c> exists
/// on the election side: two entry points that each decide for themselves will disagree eventually, and
/// the disagreement will be the one nobody tested.
/// </para>
/// </remarks>
public static class RoomJoinRules
{
    /// <summary>Longest display name a guest may type.</summary>
    public const int MaxDisplayNameLength = 60;

    /// <summary>Prefix on every link-joined identity. Never used by an authenticated member.</summary>
    public const string GuestPrefix = "guest-";

    /// <summary>
    /// Runs every gate, in order, and returns the first that refuses.
    /// </summary>
    /// <param name="room">Null when the link or id matched nothing.</param>
    /// <param name="identity">The caller's stable identity, or null for an anonymous link visitor.</param>
    /// <param name="isAdministrator">Administrators may enter any meeting.</param>
    /// <param name="isInvited">Whether <paramref name="identity"/> is on the invite list.</param>
    /// <param name="typedName">The name an anonymous visitor typed. Ignored when signed in.</param>
    /// <param name="liveCount">
    /// How many are inside now. Best effort — the media-server call is fail-soft and answers 0 when
    /// unreachable, so an outage lets people in rather than locking everyone out.
    /// </param>
    /// <param name="mediaServerReady">False when no media-server key is configured.</param>
    public static JoinDenyReason Check(
        Room? room,
        string? identity,
        bool isAdministrator,
        bool isInvited,
        string? typedName,
        DateTimeOffset now,
        int liveCount,
        bool mediaServerReady)
    {
        // A deleted meeting and a link that never existed answer the same thing on purpose. Telling a
        // stranger "that meeting was deleted" confirms the link was once real.
        if (room is null || room.IsDeleted)
        {
            return JoinDenyReason.NotFound;
        }

        if (!room.IsActive)
        {
            return JoinDenyReason.Closed;
        }

        var signedIn = !string.IsNullOrWhiteSpace(identity);
        var isPresenter = signedIn
                          && room.Type == RoomType.Presentation
                          && string.Equals(identity, room.PresenterUserId, StringComparison.Ordinal);

        // The presenter and an administrator are never gated by the join mode — a presenter locked out
        // of their own presentation is the one failure with no workaround.
        if (!isPresenter && !isAdministrator)
        {
            switch (room.JoinMode)
            {
                case RoomJoinMode.InviteOnly:
                    if (!signedIn)
                    {
                        return JoinDenyReason.NeedsSignIn;
                    }

                    if (!isInvited)
                    {
                        return JoinDenyReason.NotInvited;
                    }

                    break;

                // Membership itself is the gate: any signed-in member may come in, no list needed.
                case RoomJoinMode.Private:
                    if (!signedIn)
                    {
                        return JoinDenyReason.NeedsSignIn;
                    }

                    break;

                // Anyone holding the link, but they must say who they are. Safe only because a public
                // link is a Presentation, where the audience token cannot publish.
                case RoomJoinMode.Public:
                    if (!signedIn && string.IsNullOrWhiteSpace(SanitizeDisplayName(typedName)))
                    {
                        return JoinDenyReason.NeedsName;
                    }

                    break;
            }
        }

        // Checked after eligibility so somebody who was never getting in is told that, rather than
        // being made to wait for a countdown that will not help them.
        if (now < room.OpensAtUtc)
        {
            return JoinDenyReason.NotOpenYet;
        }

        // The presenter is never turned away by a full room. An audience that filled the seats before
        // the speaker arrived would be a meeting that cannot happen.
        if (!isPresenter && liveCount >= room.MaxParticipants)
        {
            return JoinDenyReason.Full;
        }

        // Last, because it is about us and not about them: everything else being fine, a token nothing
        // will accept is worse than an honest "unavailable".
        return mediaServerReady ? JoinDenyReason.None : JoinDenyReason.Unavailable;
    }

    /// <summary>The Persian sentence for a refusal.</summary>
    public static string Message(JoinDenyReason reason) => reason switch
    {
        JoinDenyReason.NotFound => "این جلسه پیدا نشد. ممکن است لینک اشتباه باشد یا جلسه حذف شده باشد.",
        JoinDenyReason.Closed => "این جلسه بسته شده است.",
        JoinDenyReason.NeedsSignIn => "برای ورود به این جلسه باید با کد ملی وارد شوید.",
        JoinDenyReason.NotInvited => "شما به این جلسه دعوت نشده‌اید.",
        JoinDenyReason.NotOpenYet => "هنوز زمان ورود به جلسه نرسیده است.",
        JoinDenyReason.Full => "ظرفیت این جلسه تکمیل شده است.",
        JoinDenyReason.NeedsName => "لطفاً نام و نام خانوادگی خود را وارد کنید.",
        JoinDenyReason.Unavailable => "سرویس ویدیو در دسترس نیست. لطفاً بعداً تلاش کنید.",
        _ => string.Empty
    };

    /// <summary>
    /// A fresh identity for a link visitor: <c>guest-</c> plus 16 hex characters.
    /// </summary>
    /// <remarks>
    /// Random, not derived from the name, so two guests who type the same name are still two
    /// participants — a derived identity would silently disconnect the first one when the second
    /// arrived, because the media server treats one identity as one person.
    /// </remarks>
    public static string NewGuestIdentity()
        => GuestPrefix + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();

    /// <summary>True when an identity came in through a link rather than a login.</summary>
    public static bool IsGuest(string? identity)
        => identity is not null && identity.StartsWith(GuestPrefix, StringComparison.Ordinal);

    /// <summary>
    /// Cleans a name a stranger typed before it is shown to everybody else.
    /// </summary>
    /// <remarks>
    /// <para>
    /// A guest picks their own display name, and that is accepted — the participant list marks link
    /// joins as مهمان and the presenter can remove anyone. What is <b>not</b> accepted is a name that
    /// damages the page it appears on: bidirectional override characters (U+202A–U+202E, U+2066–U+2069)
    /// can reverse the rendering of everything after them, so one guest could scramble the whole
    /// participant list for every viewer. Control characters and line breaks do the same to a
    /// single-line list.
    /// </para>
    /// <para>
    /// Escaping at render time would not be enough: this name is also sent to the media server and comes
    /// back to every other client, so it has to be clean at the point it is accepted.
    /// </para>
    /// </remarks>
    public static string SanitizeDisplayName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return string.Empty;
        }

        var sb = new StringBuilder(name.Length);
        var lastWasSpace = false;

        foreach (var rune in name.EnumerateRunes())
        {
            // The two exceptions to the rule below. U+200C is the Persian نیم‌فاصله and U+200D joins
            // letters; both are ordinary parts of a real name — «علی‌رضا» is spelt with one — and both
            // are classified Format, so a blanket strip would quietly respell people's names.
            if (rune.Value is 0x200C or 0x200D)
            {
                if (lastWasSpace)
                {
                    sb.Append(' ');
                    lastWasSpace = false;
                }

                sb.Append(rune);
                continue;
            }

            // Whitespace FIRST, and that order is load-bearing. A tab and a newline are classified
            // Control, so stripping controls before this ran would delete the gap between two words
            // and weld them together — «رضا احمدی» pasted from a textarea would become «رضااحمدی».
            // Any run collapses to one space, so a name cannot be padded out to push others off the
            // edge of the list either.
            if (Rune.IsWhiteSpace(rune))
            {
                if (sb.Length > 0)
                {
                    lastWasSpace = true;
                }

                continue;
            }

            var category = Rune.GetUnicodeCategory(rune);

            // Everything else in Format is invisible and dangerous: the bidi overrides live here, as
            // do the zero-width space and the isolates. The rest are controls, unassigned code points
            // and surrogates. None of them belongs in a name, and none of them is a word boundary —
            // they close up, which is why they are handled after whitespace and not with it.
            if (category is UnicodeCategory.Control
                or UnicodeCategory.Format
                or UnicodeCategory.LineSeparator
                or UnicodeCategory.ParagraphSeparator
                or UnicodeCategory.Surrogate
                or UnicodeCategory.PrivateUse
                or UnicodeCategory.OtherNotAssigned)
            {
                continue;
            }

            if (lastWasSpace)
            {
                sb.Append(' ');
                lastWasSpace = false;
            }

            sb.Append(rune);

            if (sb.Length >= MaxDisplayNameLength)
            {
                break;
            }
        }

        return sb.ToString();
    }
}
