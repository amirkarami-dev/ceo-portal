using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Common.Security;
using Microsoft.Extensions.Logging;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Elections.Bale;

/// <summary>
/// Handles one webhook update from the Bale bot.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="ISecretRequest"/>: this request stream carries کد ملی in message text and reveals who is
/// voting and when. The logging behaviours suppress the whole line for it.
/// </para>
/// <para>
/// <b>Never throws.</b> Bale re-delivers any update it does not get a 200 for, and a re-delivered update
/// would replay whatever the user's last message triggered. Every failure is turned into a message to the
/// user instead. The one place that genuinely must not be replayed — the cast — is protected by the
/// database's UNIQUE key regardless.
/// </para>
/// <para>
/// <b>Not <c>[Authorize]</c>.</b> There is no OIDC identity on a webhook. Authentication is the کد ملی
/// plus an OTP to the mobile the organisation has on record, and a <b>fresh OTP for every cast</b> — so a
/// leaked webhook URL cannot vote for anybody.
/// </para>
/// </remarks>
public record HandleBaleUpdateCommand(BaleUpdate Update) : IRequest, ISecretRequest;

public class HandleBaleUpdateCommandHandler(
    IBaleClient bale,
    IBaleSessionStore sessions,
    IVoteOtpStore otp,
    IVoteOtpSender otpSender,
    IEngineerDirectory directory,
    IVoterRoll roll,
    IBallotCaster caster,
    IElectionBrowser browser,
    ILogger<HandleBaleUpdateCommandHandler> logger) : IRequestHandler<HandleBaleUpdateCommand>
{
    /// <summary>Callback data prefixes. Kept short — the API caps callback data at 64 bytes.</summary>
    private const string PickElection = "e:";
    private const string ToggleCandidate = "c:";
    private const string SubmitVote = "go";
    private const string BackToElections = "b";

    public async Task Handle(HandleBaleUpdateCommand request, CancellationToken cancellationToken)
    {
        var update = request.Update;
        var chat = update.Message?.Chat ?? update.CallbackQuery?.Message?.Chat;
        var chatId = chat?.Id;

        if (chatId is null or 0)
        {
            // A channel post, an edited message, something we do not handle. Nothing to reply to.
            return;
        }

        // PRIVATE CHATS ONLY. In a group every member reads every message and they would all share one
        // session: one person identifies, and anyone else in the room can then pick candidates and cast
        // that person's ballot. Bale omits `type` on some payload shapes, so absence is treated as
        // private — the alternative is refusing legitimate one-to-one chats.
        if (chat?.Type is { } type && !type.Equals("private", StringComparison.OrdinalIgnoreCase))
        {
            await bale.SendMessageAsync(chatId.Value, BaleTexts.PrivateChatOnly, null, cancellationToken);
            return;
        }

        try
        {
            if (update.CallbackQuery is { } callback)
            {
                // Always acknowledge, or Bale leaves a spinner on the button.
                await bale.AnswerCallbackAsync(callback.Id, cancellationToken: cancellationToken);
                await OnCallbackAsync(chatId.Value, callback.Data ?? string.Empty, cancellationToken);
                return;
            }

            var text = update.Message?.Text?.Trim();
            if (!string.IsNullOrEmpty(text))
            {
                await OnTextAsync(chatId.Value, text, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            // No کد ملی, no phone, no chat id in the log line — an exception report must not become a
            // voter record. The exception itself may carry a Persian message, which is safe.
            logger.LogError(ex, "Bale update handling failed.");
            await bale.SendMessageAsync(chatId.Value, BaleTexts.VotingUnavailable, null, cancellationToken);
        }
    }

    // ── text ─────────────────────────────────────────────────────────────────

    private async Task OnTextAsync(long chatId, string text, CancellationToken ct)
    {
        if (text.StartsWith("/start", StringComparison.Ordinal))
        {
            // A restart forgets the identity as well as the selection. Otherwise a shared device would
            // leave the previous person's session live.
            await sessions.ClearAsync(chatId, ct);
            await bale.SendMessageAsync(chatId, BaleTexts.Welcome, null, ct);
            return;
        }

        var session = await sessions.GetAsync(chatId, ct);

        switch (session.Stage)
        {
            case BaleStage.AwaitingNationalCode:
                await OnNationalCodeAsync(session, text, ct);
                return;

            case BaleStage.AwaitingIdentityOtp:
                await OnIdentityOtpAsync(session, text, ct);
                return;

            case BaleStage.AwaitingVoteOtp:
                await OnVoteOtpAsync(session, text, ct);
                return;

            default:
                // Ready, but they typed instead of tapping. Re-offer the list rather than scolding.
                await ShowElectionsAsync(session, ct);
                return;
        }
    }

    private async Task OnNationalCodeAsync(BaleSession session, string text, CancellationToken ct)
    {
        var code = JalaliDate.NormalizeDigits(text).Trim();

        if (!BallotCaster.IsWellFormedNationalCode(code))
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.BadNationalCode, null, ct);
            return;
        }

        if (!roll.IsConfigured || !directory.IsConfigured)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.VotingUnavailable, null, ct);
            return;
        }

        var lookup = await directory.LookupAsync(code, ct);

        // Unavailable is answered differently from NotFound, on purpose — see BaleTexts.
        if (lookup.Outcome == DirectoryOutcome.Unavailable)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.DirectoryUnavailable, null, ct);
            return;
        }

        if (lookup.Outcome == DirectoryOutcome.NotFound || lookup.Engineer is null)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.NotFound, null, ct);
            return;
        }

        var engineer = lookup.Engineer;

        if (string.IsNullOrWhiteSpace(engineer.Mobile))
        {
            // Without a mobile there is no second factor, and the identity is only a public number.
            await bale.SendMessageAsync(session.ChatId, BaleTexts.NoMobileOnRecord, null, ct);
            return;
        }

        // Eligibility is NOT checked here. It depends on the election, is re-checked at cast, and
        // telling someone "you may not vote" before they have proven who they are would answer a
        // question about a stranger's membership to anyone who types their کد ملی.
        var issue = await otp.IssueAsync(session.ChatId, VoterKey(code), OtpPurpose.Identity, ct);

        if (issue.Outcome is OtpIssueOutcome.RateLimited or OtpIssueOutcome.LockedOut)
        {
            await bale.SendMessageAsync(session.ChatId, LimitMessage(issue), null, ct);
            return;
        }

        // Cooldown is NOT a failure: a code for this chat and this person is already in flight and still
        // valid. Advancing the stage anyway is what stops a dead end — telling someone to enter a code
        // while the conversation is still waiting for a کد ملی means their code is read as a bad one.
        if (issue.Outcome == OtpIssueOutcome.Cooldown)
        {
            session.PendingNationalCode = code;
            session.Phone = engineer.Mobile;
            session.Stage = BaleStage.AwaitingIdentityOtp;
            await sessions.SaveAsync(session, ct);

            await bale.SendMessageAsync(session.ChatId, BaleTexts.OtpAlreadySent, null, ct);
            return;
        }

        var delivery = await otpSender.SendAsync(engineer.Mobile!, issue.Code!, ct);

        session.PendingNationalCode = code;
        session.Phone = engineer.Mobile;
        session.Stage = delivery.AnyDelivered ? BaleStage.AwaitingIdentityOtp : BaleStage.AwaitingNationalCode;
        await sessions.SaveAsync(session, ct);

        await bale.SendMessageAsync(
            session.ChatId, BaleTexts.OtpSent(delivery.ViaBale, delivery.ViaSms), null, ct);
    }

    private async Task OnIdentityOtpAsync(BaleSession session, string text, CancellationToken ct)
    {
        var pending = session.PendingNationalCode;
        if (string.IsNullOrEmpty(pending))
        {
            await ResetAsync(session, ct);
            return;
        }

        var verdict = await otp.VerifyAsync(session.ChatId, VoterKey(pending), OtpPurpose.Identity, text, ct);
        if (verdict != OtpVerifyOutcome.Valid)
        {
            await bale.SendMessageAsync(
                session.ChatId,
                verdict == OtpVerifyOutcome.LockedOut ? BaleTexts.OtpLockedOut : BaleTexts.OtpWrong,
                null,
                ct);
            return;
        }

        session.NationalCode = pending;
        session.PendingNationalCode = null;
        session.Stage = BaleStage.Ready;
        session.ResetSelection();
        await sessions.SaveAsync(session, ct);

        var lookup = await directory.LookupAsync(pending, ct);
        if (lookup.Engineer is { } engineer)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.IdentityConfirmed(engineer.FullName), null, ct);
        }

        await ShowElectionsAsync(session, ct);
    }

    private async Task OnVoteOtpAsync(BaleSession session, string text, CancellationToken ct)
    {
        if (!session.IsIdentified)
        {
            await ResetAsync(session, ct);
            return;
        }

        // No pending vote is NOT a reason to destroy an identified session — that would throw away the
        // person's OTP-verified identity because they deselected their last candidate. Put them back at
        // the list instead.
        if (session.PendingElectionId is null || session.PendingChoices.Count == 0)
        {
            session.Stage = BaleStage.Ready;
            await sessions.SaveAsync(session, ct);
            await bale.SendMessageAsync(session.ChatId, BaleTexts.SelectionEmpty, null, ct);
            await ShowElectionsAsync(session, ct);
            return;
        }

        var verdict = await otp.VerifyAsync(
            session.ChatId, VoterKey(session.NationalCode!), OtpPurpose.Vote, text, ct);
        if (verdict != OtpVerifyOutcome.Valid)
        {
            await bale.SendMessageAsync(
                session.ChatId,
                verdict == OtpVerifyOutcome.LockedOut ? BaleTexts.OtpLockedOut : BaleTexts.OtpWrong,
                null,
                ct);
            return;
        }

        var electionId = session.PendingElectionId.Value;
        var choices = session.PendingChoices.ToArray();

        // Clear the pending vote BEFORE casting. If the cast throws, the OTP is already spent and the
        // selection is gone, so a retry starts over — which is the safe direction. Leaving it armed
        // would let a transport hiccup replay the same authorised selection.
        session.Stage = BaleStage.Ready;
        session.ResetSelection();
        await sessions.SaveAsync(session, ct);

        try
        {
            var result = await caster.CastAsync(session.NationalCode!, electionId, choices, ct);
            await bale.SendMessageAsync(
                session.ChatId,
                result.Accepted ? BaleTexts.VoteRecorded : result.Message,
                null,
                ct);
        }
        catch (ValidationException ex)
        {
            // The caster's Persian reasons are written for a voter — «شما قبلاً … رأی داده‌اید»,
            // «زمان رأی‌گیری … به پایان رسیده است». Show them verbatim rather than a generic failure.
            // This is also where a web-then-bot double vote lands.
            var message = ex.Errors.Values.SelectMany(v => v).FirstOrDefault() ?? BaleTexts.VotingUnavailable;
            await bale.SendMessageAsync(session.ChatId, message, null, ct);
        }

        await ShowElectionsAsync(session, ct);
    }

    // ── buttons ──────────────────────────────────────────────────────────────

    private async Task OnCallbackAsync(long chatId, string data, CancellationToken ct)
    {
        var session = await sessions.GetAsync(chatId, ct);

        // A tap from a keyboard left over after the session expired must not act on anyone's behalf.
        if (!session.IsIdentified)
        {
            await bale.SendMessageAsync(chatId, BaleTexts.SessionExpired, null, ct);
            return;
        }

        if (data == BackToElections)
        {
            session.Stage = BaleStage.Ready;
            session.ResetSelection();
            await sessions.SaveAsync(session, ct);
            await ShowElectionsAsync(session, ct);
            return;
        }

        if (data.StartsWith(PickElection, StringComparison.Ordinal)
            && int.TryParse(data[PickElection.Length..], out var electionId))
        {
            session.Stage = BaleStage.Ready;
            session.ResetSelection();
            session.PendingElectionId = electionId;
            await sessions.SaveAsync(session, ct);
            await ShowBallotAsync(session, ct);
            return;
        }

        if (data.StartsWith(ToggleCandidate, StringComparison.Ordinal)
            && int.TryParse(data[ToggleCandidate.Length..], out var candidateId))
        {
            // Changing the selection after a vote OTP has been sent would mean the ballot cast is not the
            // ballot the confirmation named. Cancel the armed code instead: the person goes back to
            // choosing, and must submit again to get a new one.
            if (session.Stage == BaleStage.AwaitingVoteOtp)
            {
                session.Stage = BaleStage.Ready;
                await sessions.SaveAsync(session, ct);
                await bale.SendMessageAsync(session.ChatId, BaleTexts.SelectionChanged, null, ct);
            }

            await ToggleAsync(session, candidateId, ct);
            return;
        }

        if (data == SubmitVote)
        {
            await StartVoteOtpAsync(session, ct);
            return;
        }

        await bale.SendMessageAsync(chatId, BaleTexts.Unknown, null, ct);
    }

    private async Task ToggleAsync(BaleSession session, int candidateId, CancellationToken ct)
    {
        var ballot = await LoadBallotAsync(session, ct);
        if (ballot is null)
        {
            await ShowElectionsAsync(session, ct);
            return;
        }

        if (ballot.Candidates.All(c => c.Id != candidateId))
        {
            // Stale keyboard from a ballot that has since changed. Re-render rather than guessing.
            await ShowBallotAsync(session, ct);
            return;
        }

        if (session.PendingChoices.Contains(candidateId))
        {
            session.PendingChoices.Remove(candidateId);
        }
        else if (ballot.MaxSelections == 1)
        {
            // Single-choice: tapping another candidate replaces the pick. Refusing the tap would make
            // the commonest election shape a deselect-then-select dance.
            session.PendingChoices.Clear();
            session.PendingChoices.Add(candidateId);
        }
        else if (session.PendingChoices.Count >= ballot.MaxSelections)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.CapReached(ballot.MaxSelections), null, ct);
            return;
        }
        else
        {
            session.PendingChoices.Add(candidateId);
        }

        await sessions.SaveAsync(session, ct);
        await ShowBallotAsync(session, ct);
    }

    private async Task StartVoteOtpAsync(BaleSession session, CancellationToken ct)
    {
        if (session.PendingChoices.Count == 0)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.SelectionEmpty, null, ct);
            return;
        }

        var ballot = await LoadBallotAsync(session, ct);
        if (ballot is null)
        {
            await ShowElectionsAsync(session, ct);
            return;
        }

        // Re-check right before arming the OTP. The window may have closed, or they may have voted on
        // the web in the meantime, while this keyboard sat open.
        if (!ballot.CanVote)
        {
            await bale.SendMessageAsync(session.ChatId, ballot.Reason, null, ct);
            session.ResetSelection();
            await sessions.SaveAsync(session, ct);
            await ShowElectionsAsync(session, ct);
            return;
        }

        if (string.IsNullOrWhiteSpace(session.Phone))
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.NoMobileOnRecord, null, ct);
            return;
        }

        // A FRESH code for the cast, every time. The session identifies; the OTP authorises. This is
        // what makes a leaked webhook URL or a hijacked chat unable to vote.
        var issue = await otp.IssueAsync(
            session.ChatId, VoterKey(session.NationalCode!), OtpPurpose.Vote, ct);

        if (issue.Outcome is OtpIssueOutcome.RateLimited or OtpIssueOutcome.LockedOut)
        {
            await bale.SendMessageAsync(session.ChatId, LimitMessage(issue), null, ct);
            return;
        }

        var names = ballot.Candidates
            .Where(c => session.PendingChoices.Contains(c.Id))
            .Select(c => c.FullName)
            .ToList();

        // Cooldown means a vote code for this chat and this person is already outstanding and still
        // valid — someone who backed out and re-submitted within the minute. Accept it rather than
        // leaving them told to enter a code the conversation is not waiting for. The confirmation below
        // is re-rendered from the CURRENT selection, so the code authorises the person and the message
        // states exactly what it will cast.
        if (issue.Outcome == OtpIssueOutcome.Cooldown)
        {
            session.Stage = BaleStage.AwaitingVoteOtp;
            await sessions.SaveAsync(session, ct);

            await bale.SendMessageAsync(session.ChatId, BaleTexts.OtpAlreadySent, null, ct);
            await bale.SendMessageAsync(session.ChatId, BaleTexts.ConfirmVote(names), null, ct);
            return;
        }

        var delivery = await otpSender.SendAsync(session.Phone!, issue.Code!, ct);
        if (!delivery.AnyDelivered)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.OtpSent(false, false), null, ct);
            return;
        }

        session.Stage = BaleStage.AwaitingVoteOtp;
        await sessions.SaveAsync(session, ct);

        await bale.SendMessageAsync(session.ChatId, BaleTexts.ConfirmVote(names), null, ct);
    }

    // ── rendering ────────────────────────────────────────────────────────────

    private async Task ShowElectionsAsync(BaleSession session, CancellationToken ct)
    {
        if (!session.IsIdentified)
        {
            await ResetAsync(session, ct);
            return;
        }

        var ballots = await browser.GetBallotsForAsync(session.NationalCode!, ct);

        // Only what they can actually act on. A list padded with elections they are not eligible for
        // would need a reason on every row, and the reason is about their membership.
        var actionable = ballots.Where(b => b.CanVote || b.AlreadyVoted).ToList();

        if (actionable.Count == 0)
        {
            // «There is no election for you» is the WRONG answer during an outage: the elections exist and
            // this person may well be eligible: we simply cannot check right now. Saying otherwise is the
            // same trap as reusing «یافت نشد» for a database fault, one step further down the flow.
            var blocked = ballots.Any(b => b.Reason == VoterEligibility.DirectoryUnavailableMessage);

            await bale.SendMessageAsync(
                session.ChatId,
                blocked ? BaleTexts.DirectoryUnavailable : BaleTexts.NoElections,
                null,
                ct);
            return;
        }

        // Voted elections keep the SAME callback as the rest. Pointing them at "back" instead would make
        // the tap look broken: the list would silently re-render and never say why. ShowBallotAsync
        // answers «شما قبلاً … رأی داده‌اید» and returns here.
        var rows = actionable
            .Select(b => (IReadOnlyList<BaleButton>)
            [
                new BaleButton(
                    b.AlreadyVoted ? $"✅ {b.Title}" : b.Title,
                    $"{PickElection}{b.Id}")
            ])
            .ToList();

        await bale.SendMessageAsync(
            session.ChatId, BaleTexts.ChooseElection, new BaleKeyboard(rows), ct);
    }

    private async Task ShowBallotAsync(BaleSession session, CancellationToken ct)
    {
        var ballot = await LoadBallotAsync(session, ct);
        if (ballot is null)
        {
            await ShowElectionsAsync(session, ct);
            return;
        }

        if (ballot.AlreadyVoted)
        {
            await bale.SendMessageAsync(session.ChatId, BaleTexts.AlreadyVoted, null, ct);
            await ShowElectionsAsync(session, ct);
            return;
        }

        if (!ballot.CanVote)
        {
            await bale.SendMessageAsync(session.ChatId, ballot.Reason, null, ct);
            await ShowElectionsAsync(session, ct);
            return;
        }

        var rows = new List<IReadOnlyList<BaleButton>>();

        // Order is exactly as the server returns it (SortOrder) — never sorted or shuffled here. A
        // changing order would change what voters see and could be argued to favour someone.
        foreach (var c in ballot.Candidates)
        {
            var chosen = session.PendingChoices.Contains(c.Id);
            var label = string.IsNullOrWhiteSpace(c.ReshteLabelOrCode)
                ? c.FullName
                : $"{c.FullName} — {c.ReshteLabelOrCode}";

            rows.Add([new BaleButton(chosen ? $"✅ {label}" : label, $"{ToggleCandidate}{c.Id}")]);
        }

        rows.Add([
            new BaleButton("ثبت رأی", SubmitVote),
            new BaleButton("بازگشت", BackToElections)
        ]);

        var window = $"{ballot.DateJalali} — {ballot.StartTime:HH\\:mm} تا {ballot.EndTime:HH\\:mm}";

        await bale.SendMessageAsync(
            session.ChatId,
            BaleTexts.ElectionHeader(ballot.Title, window, ballot.MaxSelections),
            new BaleKeyboard(rows),
            ct);
    }

    private async Task<BallotDto?> LoadBallotAsync(BaleSession session, CancellationToken ct)
    {
        if (session.PendingElectionId is null || !session.IsIdentified)
        {
            return null;
        }

        var ballots = await browser.GetBallotsForAsync(session.NationalCode!, ct);
        return ballots.FirstOrDefault(b => b.Id == session.PendingElectionId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// A stable, non-per-election hash of the کد ملی, used only for rate limiting and OTP binding.
    /// </summary>
    /// <remarks>
    /// Election id 0 is used as the scope so this can never collide with a real roll entry, whose ids
    /// start at 1. The value never reaches the database — it exists so limits can be counted per person
    /// without the کد ملی appearing in a cache key or a log line.
    /// </remarks>
    private byte[] VoterKey(string nationalCode) => roll.ComputeHash(0, nationalCode);

    private static string LimitMessage(OtpIssueResult issue) => issue.Outcome switch
    {
        OtpIssueOutcome.LockedOut => BaleTexts.OtpLockedOut,
        OtpIssueOutcome.RateLimited => BaleTexts.OtpRateLimited,
        _ => BaleTexts.AskOtp
    };

    private async Task ResetAsync(BaleSession session, CancellationToken ct)
    {
        await sessions.ClearAsync(session.ChatId, ct);
        await bale.SendMessageAsync(session.ChatId, BaleTexts.SessionExpired, null, ct);
    }
}
