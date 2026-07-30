using System.Text.Json;
using Mabhas19.Application.Elections;
using Mabhas19.Domain.Elections;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Pins the JSON contract between <c>election-web</c> and <c>/api/ElectionAdmin</c>.
/// </summary>
/// <remarks>
/// <para>
/// The payloads below are copied from what <c>election-web/src/lib/queries.ts</c> actually sends. Two
/// things in that contract are easy to get wrong and impossible to notice from the C# side alone:
/// </para>
/// <list type="number">
/// <item>
/// <b>Enums are numbers.</b> The Web host registers no <c>JsonStringEnumConverter</c>, so a client that
/// sends <c>"eligibilityMode": "ByReshte"</c> gets a 400 while one that sends <c>1</c> works. Typing the
/// TypeScript side as a string union compiles fine and then fails silently at runtime.
/// </item>
/// <item>
/// <b>The command is the body.</b> This repo binds whole commands, so the envelope is
/// <c>{ "input": { ... } }</c> — not the bare input. Getting this wrong yields a command whose
/// <c>Input</c> is null rather than a validation message.
/// </item>
/// </list>
/// <para>
/// <see cref="JsonSerializerDefaults.Web"/> is what minimal APIs use, so these tests deserialize the way
/// the endpoint does.
/// </para>
/// </remarks>
public class ElectionWireContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>Exactly what the admin form posts for a discipline-restricted election.</summary>
    private const string CreateBody = """
    {
      "input": {
        "title": "انتخاب هیئت رئیسه واحد گاز",
        "description": null,
        "eligibilityMode": 1,
        "dateJalali": "1405/05/01",
        "startTime": "08:00:00",
        "endTime": "18:00:00",
        "maxSelections": 2,
        "eligibleReshtes": [{ "code": "4", "label": "مکانیک" }],
        "candidates": [
          {
            "fullName": "کاندیدای اول",
            "description": "معرفی کوتاه",
            "reshteCode": "4",
            "educationLevel": "کارشناسی ارشد",
            "image": null,
            "sortOrder": 0
          },
          {
            "fullName": "کاندیدای دوم",
            "description": null,
            "reshteCode": null,
            "educationLevel": null,
            "image": null,
            "sortOrder": 1
          }
        ]
      }
    }
    """;

    [Test]
    public void The_create_payload_the_admin_form_posts_binds_to_the_command()
    {
        var command = JsonSerializer.Deserialize<CreateElectionCommand>(CreateBody, Web);

        command.ShouldNotBeNull();
        command!.Input.ShouldNotBeNull();
        command.Input.Title.ShouldBe("انتخاب هیئت رئیسه واحد گاز");
        command.Input.MaxSelections.ShouldBe(2);
        command.Input.Candidates.Count.ShouldBe(2);
    }

    [Test]
    public void A_numeric_eligibility_mode_binds_to_the_enum()
    {
        // 1 == ByReshte. A client sending the NAME would 400 here — see the class remarks.
        var command = JsonSerializer.Deserialize<CreateElectionCommand>(CreateBody, Web)!;

        command.Input.EligibilityMode.ShouldBe(ElectionEligibility.ByReshte);
    }

    [Test]
    public void A_string_eligibility_mode_is_rejected_rather_than_defaulting_to_AllMembers()
    {
        // This is the failure the TypeScript types were written to prevent. If this ever starts passing,
        // a JsonStringEnumConverter was added and election-web/src/lib/types.ts must change with it —
        // silently binding to AllMembers would open a restricted election to everybody.
        var body = CreateBody.Replace("\"eligibilityMode\": 1", "\"eligibilityMode\": \"ByReshte\"");

        Should.Throw<JsonException>(() => JsonSerializer.Deserialize<CreateElectionCommand>(body, Web));
    }

    [Test]
    public void The_picker_times_bind_to_TimeOnly()
    {
        // The Jalali/time fields hold "08:00" and are widened to "08:00:00" by toWireTime() before the
        // POST. Both of those are TimeOnly-parseable, but only one of them survives a round trip
        // through TimeOnly.ToString() — so the widening has to stay.
        var command = JsonSerializer.Deserialize<CreateElectionCommand>(CreateBody, Web)!;

        command.Input.StartTime.ShouldBe(new TimeOnly(8, 0));
        command.Input.EndTime.ShouldBe(new TimeOnly(18, 0));
    }

    [Test]
    public void A_bare_minute_time_also_binds_so_a_missed_widening_is_not_a_500()
    {
        var body = CreateBody.Replace("\"startTime\": \"08:00:00\"", "\"startTime\": \"08:00\"");

        var command = JsonSerializer.Deserialize<CreateElectionCommand>(body, Web)!;

        command.Input.StartTime.ShouldBe(new TimeOnly(8, 0));
    }

    [Test]
    public void Candidate_order_comes_from_the_form_list_order()
    {
        // election-web sends sortOrder = array index, and ElectionMapper keeps a non-zero SortOrder as
        // given (falling back to the index otherwise). The two only agree if the client counts from 0.
        var command = JsonSerializer.Deserialize<CreateElectionCommand>(CreateBody, Web)!;

        command.Input.Candidates[0].SortOrder.ShouldBe(0);
        command.Input.Candidates[1].SortOrder.ShouldBe(1);
    }

    [Test]
    public void The_update_payload_carries_the_id_alongside_the_input()
    {
        // The endpoint overwrites Id from the route, but the body still has to bind — a shape mismatch
        // here would be a 400 with no field to point at.
        var body = $$"""{ "id": 12, "input": {{CreateBody[CreateBody.IndexOf('{', 1)..CreateBody.LastIndexOf('}')]}} }""";

        var command = JsonSerializer.Deserialize<UpdateElectionCommand>(body, Web);

        command.ShouldNotBeNull();
        command!.Id.ShouldBe(12);
        command.Input.Title.ShouldBe("انتخاب هیئت رئیسه واحد گاز");
    }

    [Test]
    public void An_all_members_election_sends_an_empty_discipline_list()
    {
        // The form deliberately sends [] rather than a stale selection when the mode is AllMembers, so
        // the payload always matches what the admin sees on screen.
        var body = CreateBody
            .Replace("\"eligibilityMode\": 1", "\"eligibilityMode\": 0")
            .Replace("\"eligibleReshtes\": [{ \"code\": \"4\", \"label\": \"مکانیک\" }]", "\"eligibleReshtes\": []");

        var command = JsonSerializer.Deserialize<CreateElectionCommand>(body, Web)!;

        command.Input.EligibilityMode.ShouldBe(ElectionEligibility.AllMembers);
        command.Input.EligibleReshtes.ShouldBeEmpty();
        new ElectionInputValidator().Validate(command.Input).IsValid.ShouldBeTrue();
    }

    [Test]
    public void The_posted_payload_passes_the_server_validator()
    {
        // End to end for the contract: the bytes election-web sends survive binding AND validation, so
        // a well-filled form cannot be refused by the pipeline.
        var command = JsonSerializer.Deserialize<CreateElectionCommand>(CreateBody, Web)!;

        new ElectionInputValidator().Validate(command.Input).IsValid.ShouldBeTrue();
    }
}

/// <summary>
/// Pins the response shapes <c>election-web</c> reads, in the direction the client parses them.
/// </summary>
public class ElectionResponseContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    [Test]
    public void The_list_item_serialises_status_and_phase_as_numbers()
    {
        // election-web's ElectionStatus/ElectionPhase are const-object numeric enums for this reason.
        var dto = new ElectionListItemDto(
            1, "انتخابات", "1405/05/01", new TimeOnly(8, 0), new TimeOnly(18, 0),
            ElectionStatus.Published, ElectionPhase.Open, ElectionEligibility.ByReshte,
            2, 3, "ویژهٔ مهندسان مکانیک", 0);

        var json = JsonSerializer.Serialize(dto, Web);

        json.ShouldContain("\"status\":1");
        json.ShouldContain("\"phase\":3");
        json.ShouldContain("\"eligibilityMode\":1");
    }

    // ── voter side ───────────────────────────────────────────────────────────

    [Test]
    public void The_cast_payload_the_ballot_page_posts_binds_to_the_command()
    {
        // Exactly what election-web/src/lib/queries.ts sends. Note what is absent: no voter identifier.
        var body = """{ "electionId": 7, "candidateIds": [11, 13] }""";

        var command = JsonSerializer.Deserialize<CastVoteCommand>(body, Web);

        command.ShouldNotBeNull();
        command!.ElectionId.ShouldBe(7);
        command.CandidateIds.ShouldBe([11, 13]);
        new CastVoteCommandValidator().Validate(command).IsValid.ShouldBeTrue();
    }

    [Test]
    public void An_empty_selection_is_refused_before_it_reaches_the_handler()
    {
        var body = """{ "electionId": 7, "candidateIds": [] }""";

        var command = JsonSerializer.Deserialize<CastVoteCommand>(body, Web)!;

        new CastVoteCommandValidator().Validate(command).IsValid.ShouldBeFalse();
    }

    [Test]
    public void The_cast_command_has_no_voter_identifier_property()
    {
        // The design's hardest rule, checked structurally rather than by reading the record. This repo
        // binds whole commands from the request body, so ANY voter-identity property here would let a
        // signed-in engineer vote as anyone whose کد ملی they know — and کد ملی is not secret in Iran.
        var names = typeof(CastVoteCommand)
            .GetProperties()
            .Select(p => p.Name)
            .ToList();

        names.ShouldBe(["ElectionId", "CandidateIds"], ignoreOrder: true);
    }

    [Test]
    public void The_ballot_dto_carries_absolute_window_instants_for_the_countdown()
    {
        // The voter page counts down to these rather than re-deriving a Jalali date plus the Iran
        // offset. A client that had to do that conversion itself would eventually disagree with the
        // server about when voting closes.
        var dto = Ballot();

        var json = JsonSerializer.Serialize(dto, Web);

        json.ShouldContain("\"opensAtUtc\"");
        json.ShouldContain("\"closesAtUtc\"");
    }

    [Test]
    public void The_ballot_dto_never_carries_a_vote_count()
    {
        // A count visible mid-vote would tell later voters which way it is going.
        var json = JsonSerializer.Serialize(Ballot(), Web);

        json.ShouldNotContain("votes");
        json.ShouldNotContain("Count");
    }

    private static BallotDto Ballot() => new(
        1, "انتخابات", null, "1405/05/01",
        new TimeOnly(8, 0), new TimeOnly(18, 0),
        new DateTimeOffset(2026, 7, 23, 4, 30, 0, TimeSpan.Zero),
        new DateTimeOffset(2026, 7, 23, 14, 30, 0, TimeSpan.Zero),
        1, ElectionPhase.Open, "همهٔ اعضای سازمان", true, string.Empty, false,
        [new BallotCandidateDto(11, "کاندیدا", null, "مکانیک", "کارشناسی", null)]);

    [Test]
    public void The_list_item_serialises_times_the_client_can_slice_to_HH_mm()
    {
        // fromWireTime() takes the first five characters, so the wire form must be "HH:mm:ss".
        var dto = new ElectionListItemDto(
            1, "انتخابات", "1405/05/01", new TimeOnly(8, 5), new TimeOnly(18, 30),
            ElectionStatus.Draft, ElectionPhase.Draft, ElectionEligibility.AllMembers,
            1, 1, "همهٔ اعضای سازمان", 0);

        var json = JsonSerializer.Serialize(dto, Web);

        json.ShouldContain("\"startTime\":\"08:05:00\"");
        json.ShouldContain("\"endTime\":\"18:30:00\"");
    }
}
