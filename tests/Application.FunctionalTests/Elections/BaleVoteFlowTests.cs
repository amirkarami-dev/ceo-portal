using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Elections;
using Mabhas19.Application.Elections.Bale;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Domain.Elections;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Elections;

/// <summary>
/// The Bale bot conversation, end to end through the real pipeline and a real database.
/// </summary>
/// <remarks>
/// <para>
/// Step 8's success criterion is <b>"a bot vote and a web vote by the same person: the second is
/// refused"</b> — the one-vote guarantee has to hold <i>across</i> channels, not just within one. That is a
/// UNIQUE key on <c>(ElectionId, VoterHash)</c>, so only a real insert can prove it.
/// </para>
/// <para>
/// Bale itself is faked (<see cref="FakeBaleClient"/>) and so is OTP delivery, but the OTP <b>store</b> is
/// the real one behind a recorder — the cooldown, send caps and lockout under test are the ones that ship.
/// </para>
/// </remarks>
public class BaleVoteFlowTests : TestBase
{
    private const string OrgPhone = "09120000000";

    /// <summary>
    /// A fresh chat id and کد ملی for every test.
    /// </summary>
    /// <remarks>
    /// The Bale session store and the vote OTP store are <b>singletons for the whole run</b> — that is
    /// what they have to be, since the conversation state IS the store. Reusing one identity across tests
    /// therefore leaks: a live session from the previous test, and more subtly a 60-second resend cooldown
    /// that silently withholds the next code and makes every later assertion fail for the wrong reason.
    /// Isolating by identity is also closer to reality than reaching in to clear a cache.
    /// </remarks>
    private static int _seq;

    private long Chat { get; set; }
    private long OtherChat { get; set; }
    private string Voter { get; set; } = "";
    private string OtherVoter { get; set; } = "";

    [SetUp]
    public void NewIdentities()
    {
        var n = Interlocked.Increment(ref _seq);

        Chat = 900_000 + (n * 2);
        OtherChat = 900_001 + (n * 2);

        // Ten digits, distinct per test, and distinct from each other.
        Voter = (1_000_000_000 + (n * 2)).ToString();
        OtherVoter = (1_000_000_001 + (n * 2)).ToString();
    }

    private static EngineerInfo Engineer(string nationalCode, string reshte = "4") => new(
        NationalCode: nationalCode,
        FirstName: "آزمون",
        LastName: "مهندس",
        ReshteCode: reshte,
        Mobile: OrgPhone,
        MembershipStatus: 0,
        LicenceExpiryJalali: "1499/12/29",
        EducationLevel: "کارشناسی");

    private static async Task<Election> SeedOpenElectionAsync(int maxSelections = 1)
    {
        var now = DateTimeOffset.UtcNow;

        var election = new Election
        {
            Title = "انتخاب هیئت رئیسه واحد گاز",
            Status = ElectionStatus.Published,
            EligibilityMode = ElectionEligibility.AllMembers,
            DateJalali = "1405/05/01",
            Date = new DateOnly(2026, 7, 23),
            StartTime = new TimeOnly(0, 0),
            EndTime = new TimeOnly(23, 59),
            OpensAtUtc = now.AddHours(-1),
            ClosesAtUtc = now.AddHours(1),
            MaxSelections = maxSelections,
            Candidates =
            {
                new ElectionCandidate { FullName = "کاندیدای اول", ReshteCode = "4", SortOrder = 0 },
                new ElectionCandidate { FullName = "کاندیدای دوم", ReshteCode = "5", SortOrder = 1 },
                new ElectionCandidate { FullName = "کاندیدای سوم", SortOrder = 2 }
            }
        };

        await TestApp.AddAsync(election);
        return election;
    }

    // ── conversation helpers ─────────────────────────────────────────────────

    private Task TextAsync(string text, long? chatId = null) =>
        TestApp.SendAsync(new HandleBaleUpdateCommand(new BaleUpdate(
            UpdateId: 1,
            Message: new BaleMessage(1, new BaleChat(chatId ?? Chat, "private"), text),
            CallbackQuery: null)));

    private Task TapAsync(string data, long? chatId = null) =>
        TestApp.SendAsync(new HandleBaleUpdateCommand(new BaleUpdate(
            UpdateId: 1,
            Message: null,
            CallbackQuery: new BaleCallbackQuery(
                "cb-1", new BaleMessage(1, new BaleChat(chatId ?? Chat, "private"), null), data))));

    /// <summary>`/start` → کد ملی → OTP, leaving the chat identified and looking at the election list.</summary>
    private async Task IdentifyAsync(string? nationalCode = null, long? chatId = null)
    {
        await TextAsync("/start", chatId);
        await TextAsync(nationalCode ?? Voter, chatId);
        await TextAsync(TestApp.LastOtp(), chatId);
    }

    /// <summary>Taps the election, taps the first candidate, submits, then enters the fresh OTP.</summary>
    private async Task VoteAsync(int electionId, long? chatId = null)
    {
        await TapAsync($"e:{electionId}", chatId);

        var candidateId = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.First(d => d.StartsWith("c:", StringComparison.Ordinal));

        await TapAsync(candidateId, chatId);
        await TapAsync("go", chatId);
        await TextAsync(TestApp.LastOtp(), chatId);
    }

    /// <summary>The same کد ملی as a Persian-keyboard user would send it.</summary>
    private static string ToPersianDigits(string code) =>
        string.Concat(code.Select(c => char.IsAsciiDigit(c) ? (char)('۰' + (c - '0')) : c));

    // ── the criterion ────────────────────────────────────────────────────────

    [Test]
    public async Task An_engineer_can_vote_through_the_bot()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await VoteAsync(election.Id);

        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text.Contains("رأی شما ثبت شد"));
        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_web_vote_after_a_bot_vote_by_the_same_person_is_refused()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await VoteAsync(election.Id);

        // Same person, now on the web. The roll is keyed on the کد ملی, not on the channel, so the
        // UNIQUE key fires exactly as it would for a second web vote.
        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await TestApp.CandidateIdsAsync(election.Id);

        var ex = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[1]])));

        ex.Errors["Voter"].ShouldContain("شما قبلاً در این انتخابات رأی داده‌اید");
        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_bot_vote_after_a_web_vote_by_the_same_person_is_refused()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await TestApp.CandidateIdsAsync(election.Id);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        // The bot must not even offer the ballot — and if it is reached anyway, the cast must refuse.
        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");

        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text.Contains("قبلاً"));
        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task Persian_digits_in_the_bot_and_latin_on_the_web_are_the_same_person()
    {
        // The trap: the bot receives a کد ملی from a Persian keyboard. If the two digit forms hashed
        // differently, the UNIQUE key would not fire and one person would vote twice.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync(ToPersianDigits(Voter));
        await VoteAsync(election.Id);

        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await TestApp.CandidateIdsAsync(election.Id);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]])));

        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
    }

    [Test]
    public async Task A_second_bot_vote_from_the_same_chat_is_refused()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await VoteAsync(election.Id);

        // Back at the list: the election is marked as voted and tapping it does not open a ballot.
        await TapAsync($"e:{election.Id}");

        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text.Contains("قبلاً"));
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task Two_different_engineers_on_two_chats_both_vote()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.Add(Engineer(OtherVoter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync(Voter, Chat);
        await VoteAsync(election.Id, Chat);

        await IdentifyAsync(OtherVoter, OtherChat);
        await VoteAsync(election.Id, OtherChat);

        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(2);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(2);
    }

    // ── identification ───────────────────────────────────────────────────────

    [Test]
    public async Task Start_asks_for_the_national_code()
    {
        await TextAsync("/start");

        FunctionalTestSetup.Bale.Last!.Text.ShouldContain("کد ملی");
    }

    [Test]
    public async Task A_malformed_national_code_is_rejected_without_a_directory_call()
    {
        await TextAsync("/start");
        await TextAsync("12345");

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.BadNationalCode);
        FunctionalTestSetup.OtpSender.SendCount.ShouldBe(0);
    }

    [Test]
    public async Task An_unknown_national_code_gets_the_not_found_wording()
    {
        await TextAsync("/start");
        await TextAsync(Voter); // directory left empty

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.NotFound);
        FunctionalTestSetup.OtpSender.SendCount.ShouldBe(0);
    }

    [Test]
    public async Task A_directory_outage_never_reuses_the_not_found_wording()
    {
        // GOTCHAS records «این کد ملی یافت نشد» once being shown for a database fault. During an
        // election that would tell every voter they are not a member.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.IsUnavailable = true;

        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.DirectoryUnavailable);
        FunctionalTestSetup.Bale.Last!.Text.ShouldNotContain("یافت نشد");
    }

    [Test]
    public async Task An_engineer_with_no_mobile_on_record_cannot_start()
    {
        // Without a mobile there is no second factor, and the کد ملی alone is a public number.
        FunctionalTestSetup.Directory.Add(Engineer(Voter) with { Mobile = null });

        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.NoMobileOnRecord);
        FunctionalTestSetup.OtpSender.SendCount.ShouldBe(0);
    }

    [Test]
    public async Task The_otp_goes_to_the_organisations_number_not_to_anything_the_user_typed()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));

        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.OtpSender.LastPhone.ShouldBe(OrgPhone);
    }

    [Test]
    public async Task A_wrong_otp_does_not_identify_the_chat()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await TextAsync("/start");
        await TextAsync(Voter);
        await TextAsync("00000".Equals(TestApp.LastOtp(), StringComparison.Ordinal) ? "11111" : "00000");

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.OtpWrong);

        // And the election list was never shown.
        FunctionalTestSetup.Bale.Sent.ShouldNotContain(m => m.Text == BaleTexts.ChooseElection);
    }

    [Test]
    public async Task The_bot_never_echoes_the_national_code_back()
    {
        // It would then sit in the chat history on the device and on Bale's servers.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await IdentifyAsync();

        FunctionalTestSetup.Bale.Sent.ShouldAllBe(m => !m.Text.Contains(Voter));
    }

    // ── the cast needs a FRESH code ──────────────────────────────────────────

    [Test]
    public async Task Casting_requires_a_second_code_not_the_identity_one()
    {
        // The design's fix for a leaked webhook URL: the session identifies, the OTP authorises. If the
        // identity code were reusable, one captured code would cast a vote at any time.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await TextAsync("/start");
        await TextAsync(Voter);
        var identityCode = TestApp.LastOtp();
        await TextAsync(identityCode);

        await TapAsync($"e:{election.Id}");
        var candidate = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.First(d => d.StartsWith("c:", StringComparison.Ordinal));
        await TapAsync(candidate);
        await TapAsync("go");

        // A second, different code was issued for the cast.
        FunctionalTestSetup.Otp!.IssueCount.ShouldBe(2);
        TestApp.LastOtp().ShouldNotBe(identityCode);

        // Re-entering the identity code does not cast.
        await TextAsync(identityCode);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);

        // The fresh one does.
        await TextAsync(TestApp.LastOtp());
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_vote_code_cannot_be_replayed()
    {
        // A webhook re-delivery must not cast twice. The code is single-use; the UNIQUE key is the
        // backstop behind it.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");
        var candidate = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.First(d => d.StartsWith("c:", StringComparison.Ordinal));
        await TapAsync(candidate);
        await TapAsync("go");

        var voteCode = TestApp.LastOtp();
        await TextAsync(voteCode);
        await TextAsync(voteCode);

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_button_tap_from_an_unidentified_chat_does_nothing()
    {
        // A keyboard left over after the session expired must not act on anyone's behalf.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await TapAsync($"e:{election.Id}");

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.SessionExpired);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task Start_forgets_a_previous_identity()
    {
        // A shared device must not leave the previous person's session live.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TextAsync("/start");
        await TapAsync($"e:{election.Id}");

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.SessionExpired);
    }

    // ── selection rules ──────────────────────────────────────────────────────

    [Test]
    public async Task Submitting_with_nothing_selected_is_refused()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");
        await TapAsync("go");

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.SelectionEmpty);
        FunctionalTestSetup.Otp!.IssueCount.ShouldBe(1); // identity only; no vote code was armed
    }

    [Test]
    public async Task A_single_choice_election_replaces_the_pick_rather_than_stacking()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync(maxSelections: 1);

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");

        var buttons = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.Where(d => d.StartsWith("c:", StringComparison.Ordinal)).ToList();

        await TapAsync(buttons[0]);
        await TapAsync(buttons[1]);
        await TapAsync("go");
        await TextAsync(TestApp.LastOtp());

        // One ballot, and the confirmation named exactly one candidate.
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
        FunctionalTestSetup.Bale.Sent
            .Last(m => m.Text.Contains("رأی شما به این افراد"))
            .Text.Split('•').Length.ShouldBe(2);
    }

    [Test]
    public async Task A_multi_choice_election_stops_at_the_cap()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync(maxSelections: 2);

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");

        var buttons = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.Where(d => d.StartsWith("c:", StringComparison.Ordinal)).ToList();

        await TapAsync(buttons[0]);
        await TapAsync(buttons[1]);
        await TapAsync(buttons[2]);

        // The third tap is refused with a visible reason, not silently ignored.
        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.CapReached(2));
    }

    [Test]
    public async Task Tapping_a_chosen_candidate_again_deselects_it()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync(maxSelections: 2);

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");

        var buttons = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.Where(d => d.StartsWith("c:", StringComparison.Ordinal)).ToList();

        await TapAsync(buttons[0]);
        FunctionalTestSetup.Bale.LastWithKeyboard!.ButtonLabels.ShouldContain(l => l.StartsWith("✅"));

        await TapAsync(buttons[0]);
        FunctionalTestSetup.Bale.LastWithKeyboard!.ButtonLabels.ShouldAllBe(l => !l.StartsWith("✅"));
    }

    [Test]
    public async Task Candidate_buttons_are_in_the_admins_order_and_show_the_discipline_name()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");

        var labels = FunctionalTestSetup.Bale.LastWithKeyboard!.ButtonLabels;

        labels[0].ShouldBe("کاندیدای اول — مکانیک");
        labels[1].ShouldBe("کاندیدای دوم — برق");
        labels[2].ShouldBe("کاندیدای سوم"); // no discipline on record → no suffix, not «رشتهٔ »
    }

    // ── the OTP must reach the registered mobile, never the chat ──────────────

    [Test]
    public async Task The_otp_code_is_never_written_into_the_chat()
    {
        // The CRITICAL finding from the adversarial review. Delivering the code as a chat message made a
        // PUBLIC number the only factor: open your own chat, type any member's کد ملی, read the code off
        // your own screen, cast their ballot — irreversibly, because the roll then treats the real member
        // as having already voted.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await VoteAsync(election.Id);

        // Two codes were issued and both were handed to the phone-bound channels.
        FunctionalTestSetup.Otp!.Codes.Count.ShouldBe(2);
        FunctionalTestSetup.OtpSender.DeliveredCodes.ShouldBe(FunctionalTestSetup.Otp!.Codes);
        FunctionalTestSetup.OtpSender.LastPhone.ShouldBe(OrgPhone);

        // And not one of them appears in anything the bot said in the conversation.
        foreach (var code in FunctionalTestSetup.Otp!.Codes)
        {
            FunctionalTestSetup.Bale.Sent.ShouldAllBe(m => !m.Text.Contains(code));
        }
    }

    [Test]
    public async Task An_attackers_chat_cannot_redeem_a_code_issued_for_a_victim()
    {
        // Even with the delivery fixed, the code must be bound to the chat that asked. Otherwise an
        // attacker who somehow saw a code could redeem it from their own conversation.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        // The real owner starts, and their code is issued for THEIR chat.
        await TextAsync("/start", Chat);
        await TextAsync(Voter, Chat);
        var ownersCode = TestApp.LastOtp();

        // An attacker, knowing only the public کد ملی, tries to use it from a different chat.
        await TextAsync("/start", OtherChat);
        await TextAsync(Voter, OtherChat);
        await TextAsync(ownersCode, OtherChat);

        FunctionalTestSetup.Bale.Sent
            .Where(m => m.ChatId == OtherChat)
            .ShouldNotContain(m => m.Text == BaleTexts.ChooseElection);
    }

    // ── group chats ──────────────────────────────────────────────────────────

    [Test]
    public async Task A_group_chat_is_refused()
    {
        // In a group every member reads every message and they would all share one identified session:
        // one person proves who they are, and anybody else in the room casts their ballot.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await TestApp.SendAsync(new HandleBaleUpdateCommand(new BaleUpdate(
            UpdateId: 1,
            Message: new BaleMessage(1, new BaleChat(Chat, "supergroup"), "/start"),
            CallbackQuery: null)));

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.PrivateChatOnly);
        FunctionalTestSetup.OtpSender.SendCount.ShouldBe(0);
    }

    // ── the confirmed selection is the cast selection ─────────────────────────

    [Test]
    public async Task Changing_a_candidate_after_the_code_was_sent_cancels_it()
    {
        // Otherwise the ballot cast is not the ballot the confirmation named: arm the code for candidate
        // A, switch to B, enter the code, and B is cast against a confirmation that said A.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");
        var buttons = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.Where(d => d.StartsWith("c:", StringComparison.Ordinal)).ToList();

        await TapAsync(buttons[0]);
        await TapAsync("go");
        var armedCode = TestApp.LastOtp();

        // Switch candidate while the code is armed.
        await TapAsync(buttons[1]);
        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text == BaleTexts.SelectionChanged);

        // The armed code no longer casts anything.
        await TextAsync(armedCode);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task Deselecting_everything_does_not_destroy_the_identified_session()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");
        var candidate = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.First(d => d.StartsWith("c:", StringComparison.Ordinal));

        await TapAsync(candidate);
        await TapAsync("go");
        await TapAsync(candidate); // deselect — the selection is now empty
        await TextAsync(TestApp.LastOtp());

        // Still identified: they are put back at the list, not logged out.
        FunctionalTestSetup.Bale.Last!.Text.ShouldNotBe(BaleTexts.SessionExpired);
        await TapAsync($"e:{election.Id}");
        FunctionalTestSetup.Bale.LastWithKeyboard!.CallbackData
            .ShouldContain(d => d.StartsWith("c:", StringComparison.Ordinal));
    }

    // ── outage must not read as "nothing for you" ───────────────────────────--

    [Test]
    public async Task A_directory_outage_after_identification_is_not_reported_as_no_elections()
    {
        // «There is no election for you» is the wrong answer during an outage: the election exists and
        // this person may well be eligible — we simply cannot check. Same trap as reusing «یافت نشد».
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await IdentifyAsync();

        FunctionalTestSetup.Directory.IsUnavailable = true;
        await TextAsync("anything"); // Ready + text → re-render the list

        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.DirectoryUnavailable);
        FunctionalTestSetup.Bale.Last!.Text.ShouldNotBe(BaleTexts.NoElections);
    }

    [Test]
    public async Task A_lockout_in_one_chat_does_not_lock_the_real_voter_out()
    {
        // کد ملی is public. A per-person lockout was a weapon: burn five wrong guesses from your own chat
        // and the real member cannot use the bot for the whole lockout window.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        // An attacker's chat requests a code for the victim, then burns the attempt budget.
        await TextAsync("/start", OtherChat);
        await TextAsync(Voter, OtherChat);
        for (var i = 0; i < 6; i++)
        {
            await TextAsync("00000", OtherChat);
        }
        FunctionalTestSetup.Bale.Sent.Where(m => m.ChatId == OtherChat)
            .ShouldContain(m => m.Text == BaleTexts.OtpLockedOut);

        // The real owner is unaffected.
        await TextAsync("/start", Chat);
        await TextAsync(Voter, Chat);
        await TextAsync(TestApp.LastOtp(), Chat);

        FunctionalTestSetup.Bale.Sent.Where(m => m.ChatId == Chat)
            .ShouldContain(m => m.Text == BaleTexts.ChooseElection);
    }

    // ── no dead ends ─────────────────────────────────────────────────────────

    [Test]
    public async Task Re_entering_a_national_code_inside_the_cooldown_still_accepts_the_outstanding_code()
    {
        // The dead end this guards: the resend cooldown returns no new code, and if the conversation is
        // left waiting for a کد ملی, the code the user already has is read as a malformed کد ملی.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await TextAsync("/start");
        await TextAsync(Voter);
        var code = TestApp.LastOtp();

        // /start again, then the same کد ملی — the realistic way back to the national-code stage inside
        // the cooldown window. (Re-sending the کد ملی without /start is read as an OTP guess, because the
        // conversation is waiting for a code.)
        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.Otp!.IssueCount.ShouldBe(1);
        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.OtpAlreadySent);

        // And the code from the first attempt still identifies — the conversation advanced to the OTP
        // stage instead of leaving the code to be read as a malformed کد ملی.
        await TextAsync(code);
        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text == BaleTexts.ChooseElection);
    }

    [Test]
    public async Task Re_submitting_a_vote_inside_the_cooldown_still_accepts_the_outstanding_code()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await TapAsync($"e:{election.Id}");
        var candidate = FunctionalTestSetup.Bale.LastWithKeyboard!
            .CallbackData.First(d => d.StartsWith("c:", StringComparison.Ordinal));
        await TapAsync(candidate);
        await TapAsync("go");

        var voteCode = TestApp.LastOtp();

        // Back out and submit again within the minute.
        await TapAsync("b");
        await TapAsync($"e:{election.Id}");
        await TapAsync(candidate);
        await TapAsync("go");

        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text == BaleTexts.OtpAlreadySent);
        // The confirmation is re-shown, so the user knows what the code will cast.
        FunctionalTestSetup.Bale.Last!.Text.ShouldContain("رأی شما به این افراد");

        await TextAsync(voteCode);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task Tapping_an_already_voted_election_says_so_rather_than_silently_redrawing()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await IdentifyAsync();
        await VoteAsync(election.Id);

        // The ✅ row must carry a real callback, not "back" — otherwise the tap looks broken.
        var list = FunctionalTestSetup.Bale.LastWithKeyboard!;
        list.ButtonLabels.ShouldContain(l => l.StartsWith("✅"));
        list.CallbackData.ShouldAllBe(d => d.StartsWith("e:"));

        var before = FunctionalTestSetup.Bale.Sent.Count;
        await TapAsync($"e:{election.Id}");

        FunctionalTestSetup.Bale.Sent.Skip(before)
            .ShouldContain(m => m.Text == BaleTexts.AlreadyVoted);
    }

    [Test]
    public async Task One_persons_code_request_does_not_block_another_chat()
    {
        // کد ملی is public. If the resend cooldown were keyed on the person alone, anyone could request a
        // code for someone else's کد ملی from their own chat and keep the real voter locked out.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        await SeedOpenElectionAsync();

        await TextAsync("/start", OtherChat);
        await TextAsync(Voter, OtherChat); // an attacker's chat, using a public number

        await TextAsync("/start", Chat);
        await TextAsync(Voter, Chat); // the real owner

        // Two codes issued, one per chat — the second was not swallowed by the first's cooldown.
        FunctionalTestSetup.Otp!.IssueCount.ShouldBe(2);

        // And the code delivered to the attacker's chat does not work in the owner's chat.
        await TextAsync(FunctionalTestSetup.Otp!.Codes[0], Chat);
        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.OtpWrong);

        await TextAsync(FunctionalTestSetup.Otp!.Codes[1], Chat);
        FunctionalTestSetup.Bale.Sent.ShouldContain(m => m.Text == BaleTexts.ChooseElection);
    }

    // ── delivery ─────────────────────────────────────────────────────────────

    [Test]
    public async Task When_only_one_channel_works_the_user_is_told_which()
    {
        // Someone whose Bale push failed would otherwise wait for a message already in their SMS inbox.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.OtpSender.ViaBale = false;

        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.Bale.Last!.Text.ShouldContain("پیامک");
    }

    [Test]
    public async Task When_neither_channel_works_the_chat_is_not_left_waiting_for_a_code()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.OtpSender.ViaBale = false;
        FunctionalTestSetup.OtpSender.ViaSms = false;

        await TextAsync("/start");
        await TextAsync(Voter);

        FunctionalTestSetup.Bale.Last!.Text.ShouldContain("ناموفق");

        // Still at the national-code stage, so entering a code is not mistaken for an OTP.
        await TextAsync("54321");
        FunctionalTestSetup.Bale.Last!.Text.ShouldBe(BaleTexts.BadNationalCode);
    }
}
