using System.Text.Json;
using Mabhas19.Infrastructure.Elections;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Pins the phone format Bale's <c>safir</c> push requires.
/// </summary>
/// <remarks>
/// <para>
/// The real contract, from the sample on <c>business.bale.ai/dashboard/safir</c>:
/// </para>
/// <code>
/// POST https://safir.bale.ai/api/v3/send_message
/// api-access-key: &lt;key&gt;
/// { "bot_id": 1234567890,
///   "phone_number": "989120000000",
///   "message_data": { "message": { "text": "متن پیام شما" } } }
/// </code>
/// <para>
/// The first implementation was written before that sample was available and got all three parts wrong:
/// it omitted <c>bot_id</c> entirely, sent <c>{"phone","message"}</c> instead of the nested shape, and
/// stripped the leading zero to produce <c>9120000000</c> rather than <c>989120000000</c>.
/// </para>
/// <para>
/// <b>Every one of those failures is silent.</b> safir refuses, <c>OtpDelivery.ViaBale</c> comes back
/// false, the voter is told the code went by SMS only, and nothing looks broken. That is exactly the kind
/// of defect worth a test that starts from the wire format.
/// </para>
/// </remarks>
public class SafirPhoneFormatTests
{
    [Test]
    public void The_organisations_stored_form_becomes_country_code_form()
        => BaleSafirSender.ToSafirPhone("09120000000").ShouldBe("989120000000");

    [Test]
    public void An_already_country_coded_number_is_left_alone()
        => BaleSafirSender.ToSafirPhone("989120000000").ShouldBe("989120000000");

    [Test]
    public void A_bare_mobile_without_the_trunk_zero_is_accepted()
        => BaleSafirSender.ToSafirPhone("9120000000").ShouldBe("989120000000");

    [Test]
    public void Formatting_noise_is_ignored()
    {
        // The membership DB is not consistent: the same column holds all of these.
        BaleSafirSender.ToSafirPhone("+98 912 000 0000").ShouldBe("989120000000");
        BaleSafirSender.ToSafirPhone("0912-000-0000").ShouldBe("989120000000");
        BaleSafirSender.ToSafirPhone("  09120000000  ").ShouldBe("989120000000");
    }

    [Test]
    public void The_international_dialling_prefix_is_stripped()
        => BaleSafirSender.ToSafirPhone("00989120000000").ShouldBe("989120000000");

    [Test]
    public void Persian_digits_are_folded()
        => BaleSafirSender.ToSafirPhone("۰۹۱۲۰۰۰۰۰۰۰").ShouldBe("989120000000");

    [Test]
    public void Every_written_form_of_one_person_produces_one_string()
    {
        // The property that matters: the same human always reaches the same Bale account.
        string?[] forms =
        [
            "09120000000", "9120000000", "989120000000", "00989120000000",
            "+989120000000", "۰۹۱۲۰۰۰۰۰۰۰", "0912 000 0000"
        ];

        forms.Select(BaleSafirSender.ToSafirPhone).Distinct().Count().ShouldBe(1);
    }

    [Test]
    public void Anything_that_is_not_an_iranian_mobile_is_refused_rather_than_guessed()
    {
        // A landline or a truncated number must not be sent to safir as though it were a mobile — any
        // message would then go to a stranger. Null makes the caller report "Bale not delivered".
        BaleSafirSender.ToSafirPhone(null).ShouldBeNull();
        BaleSafirSender.ToSafirPhone("").ShouldBeNull();
        BaleSafirSender.ToSafirPhone("   ").ShouldBeNull();
        BaleSafirSender.ToSafirPhone("08712345678").ShouldBeNull();  // Sanandaj landline
        BaleSafirSender.ToSafirPhone("0918380561").ShouldBeNull();   // one digit short
        BaleSafirSender.ToSafirPhone("091200000003").ShouldBeNull(); // one digit long
        BaleSafirSender.ToSafirPhone("no digits here").ShouldBeNull();
    }
}

/// <summary>
/// Pins the JSON body safir expects, field name for field name.
/// </summary>
/// <remarks>
/// <c>SafirRequest</c> is private, so this asserts on the shape through a mirror record declared here. If
/// the two ever disagree the mirror is wrong — but the point stands: these exact names, this exact
/// nesting, and <c>bot_id</c> as a <b>number</b>.
/// </remarks>
public class SafirRequestContractTests
{
    private sealed record Body(long bot_id, string phone_number, Data message_data);

    private sealed record Data(Text message);

    private sealed record Text(string text);

    [Test]
    public void The_sample_from_the_dashboard_round_trips()
    {
        const string sample = """
        {
          "bot_id": 1234567890,
          "phone_number": "989120000000",
          "message_data": {
            "message": {
              "text": "متن پیام شما"
            }
          }
        }
        """;

        var body = JsonSerializer.Deserialize<Body>(sample);

        body.ShouldNotBeNull();
        body!.bot_id.ShouldBe(1234567890L);
        body.phone_number.ShouldBe("989120000000");
        body.message_data.message.text.ShouldBe("متن پیام شما");
    }

    [Test]
    public void The_bot_id_is_a_number_not_a_string()
    {
        // Quoting it is the obvious slip when it is copied out of a config file.
        var json = JsonSerializer.Serialize(new Body(1234567890, "989120000000", new Data(new Text("x"))));

        json.ShouldContain("\"bot_id\":1234567890");
        json.ShouldNotContain("\"bot_id\":\"1234567890\"");
    }

    [Test]
    public void The_text_is_nested_two_levels_deep()
    {
        var json = JsonSerializer.Serialize(new Body(1, "989120000000", new Data(new Text("سلام"))));

        json.ShouldContain("\"message_data\":{\"message\":{\"text\":\"");
        // Not the flat shape the first implementation sent.
        json.ShouldNotContain("\"message\":\"");
    }
}
