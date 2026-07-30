using System.Text.Json;
using Mabhas19.Application.Common;
using Mabhas19.Application.Elections.Bale;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Pins the JSON contract of the Bale webhook payload.
/// </summary>
/// <remarks>
/// <para>
/// <b>This file exists because of a real bug that every other test missed.</b> Bale's API is a Telegram
/// clone and sends <b>snake_case</b> — <c>update_id</c>, <c>callback_query</c>, <c>message_id</c>. Minimal
/// APIs bind with <see cref="JsonSerializerDefaults.Web"/>, which is camelCase. The first version of
/// <see cref="BaleUpdate"/> had no <c>[JsonPropertyName]</c> attributes, so <c>callback_query</c> did not
/// bind and <b>every inline-button tap was silently dropped</b>: the bot answered <c>/start</c> and the
/// OTP normally, then went dead the moment a voter tapped an election. Nothing failed — the webhook still
/// returned 200 with an update whose <c>CallbackQuery</c> was null.
/// </para>
/// <para>
/// The functional tests could not catch it: they construct <see cref="BaleUpdate"/> records in C# and hand
/// them to MediatR, bypassing deserialisation entirely. Only a test that starts from bytes can.
/// </para>
/// </remarks>
public class BaleWireContractTests
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>A text message, as Bale actually posts it.</summary>
    private const string TextUpdate = """
    {
      "update_id": 908123,
      "message": {
        "message_id": 41,
        "from": { "id": 771, "is_bot": false, "first_name": "علی" },
        "chat": { "id": 771, "type": "private", "first_name": "علی" },
        "date": 1785400000,
        "text": "/start"
      }
    }
    """;

    /// <summary>An inline-button tap. This is the shape that silently failed to bind.</summary>
    private const string CallbackUpdate = """
    {
      "update_id": 908124,
      "callback_query": {
        "id": "4382919",
        "from": { "id": 771, "is_bot": false, "first_name": "علی" },
        "message": {
          "message_id": 42,
          "chat": { "id": 771, "type": "private" },
          "date": 1785400100,
          "text": "یکی از انتخابات زیر را انتخاب کنید:"
        },
        "chat_instance": "-90210",
        "data": "e:7"
      }
    }
    """;

    [Test]
    public void A_text_message_binds()
    {
        var update = JsonSerializer.Deserialize<BaleUpdate>(TextUpdate, Web);

        update.ShouldNotBeNull();
        update!.UpdateId.ShouldBe(908123);
        update.Message.ShouldNotBeNull();
        update.Message!.Chat!.Id.ShouldBe(771);
        update.Message.Text.ShouldBe("/start");
        update.CallbackQuery.ShouldBeNull();
    }

    [Test]
    public void A_button_tap_binds()
    {
        // The regression guard. If this ever returns null again, the whole voting keyboard is dead.
        var update = JsonSerializer.Deserialize<BaleUpdate>(CallbackUpdate, Web);

        update.ShouldNotBeNull();
        update!.CallbackQuery.ShouldNotBeNull();
        update.CallbackQuery!.Id.ShouldBe("4382919");
        update.CallbackQuery.Data.ShouldBe("e:7");
        update.CallbackQuery.Message!.Chat!.Id.ShouldBe(771);
    }

    [Test]
    public void The_update_id_binds_from_snake_case()
        => JsonSerializer.Deserialize<BaleUpdate>(TextUpdate, Web)!.UpdateId.ShouldBe(908123);

    [Test]
    public void The_message_id_binds_from_snake_case()
        => JsonSerializer.Deserialize<BaleUpdate>(TextUpdate, Web)!.Message!.MessageId.ShouldBe(41);

    [Test]
    public void The_chat_type_binds_so_group_chats_can_be_refused()
    {
        // Without `type` the bot cannot tell a private chat from a group, where every member would read
        // the OTP and share one identified session.
        JsonSerializer.Deserialize<BaleUpdate>(TextUpdate, Web)!.Message!.Chat!.Type.ShouldBe("private");

        var group = TextUpdate.Replace("\"type\": \"private\"", "\"type\": \"supergroup\"");
        JsonSerializer.Deserialize<BaleUpdate>(group, Web)!.Message!.Chat!.Type.ShouldBe("supergroup");
    }

    [Test]
    public void Unknown_fields_are_ignored_rather_than_rejected()
    {
        // The payload above already carries `from`, `date`, `is_bot`, `chat_instance` — none of which is
        // bound. Bale adding a field must never start failing the webhook, because a non-200 makes Bale
        // re-deliver the update and replay the user's last step.
        Should.NotThrow(() => JsonSerializer.Deserialize<BaleUpdate>(CallbackUpdate, Web));
    }

    [Test]
    public void An_update_with_neither_a_message_nor_a_callback_binds_to_nulls()
    {
        // e.g. an edited message or a channel post. The handler returns without replying; it must not
        // throw, or Bale would retry forever.
        var update = JsonSerializer.Deserialize<BaleUpdate>("""{ "update_id": 5 }""", Web);

        update.ShouldNotBeNull();
        update!.Message.ShouldBeNull();
        update.CallbackQuery.ShouldBeNull();
    }
}

/// <summary>
/// <see cref="JalaliDate.NormalizeDigits"/> is called on attacker-controlled webhook text.
/// </summary>
public class NormalizeDigitsSafetyTests
{
    [Test]
    public void A_very_long_input_does_not_blow_the_stack()
    {
        // This was a remote kill switch: the implementation did `stackalloc char[value.Length]`, so one
        // anonymous webhook POST with a megabyte of text asked for two megabytes of stack.
        // StackOverflowException cannot be caught — the API process dies, taking every other service with
        // it, mid-election.
        var huge = new string('۵', 4_000_000);

        var result = JalaliDate.NormalizeDigits(huge);

        result.Length.ShouldBe(4_000_000);
        result[0].ShouldBe('5');
        result[^1].ShouldBe('5');
    }

    [Test]
    public void Short_inputs_still_normalise_identically()
    {
        JalaliDate.NormalizeDigits("۱۴۰۵/۰۵/۰۱").ShouldBe("1405/05/01");
        JalaliDate.NormalizeDigits("١٢٣").ShouldBe("123");
        JalaliDate.NormalizeDigits("  ۱۲۳۴۵۶۷۸۹۰  ").ShouldBe("1234567890");
    }

    [Test]
    public void The_heap_path_and_the_stack_path_agree()
    {
        // 256 characters is the threshold; the two implementations must be indistinguishable across it.
        var under = new string('۷', 200);
        var over = new string('۷', 2_000);

        JalaliDate.NormalizeDigits(under).ShouldBe(new string('7', 200));
        JalaliDate.NormalizeDigits(over).ShouldBe(new string('7', 2_000));
    }
}
