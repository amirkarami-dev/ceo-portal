using System.Text.Json.Serialization;

namespace Mabhas19.Application.Elections.Bale;

/// <summary>
/// The slice of a Bale webhook update this bot uses.
/// </summary>
/// <remarks>
/// <para>
/// Bale's API mirrors Telegram's, and the payload carries far more than this — user names, chat titles,
/// forwarded messages, attachments. Only what is needed is bound: unmapped JSON is ignored by
/// System.Text.Json, and a narrow shape means a change on their side cannot start feeding new fields
/// into a voting flow.
/// </para>
/// <para>
/// <b>Every name is spelled out with <see cref="JsonPropertyNameAttribute"/>, and it is load-bearing.</b>
/// Minimal APIs bind with <c>JsonSerializerDefaults.Web</c>, which is camelCase — so <c>callback_query</c>
/// does NOT match a <c>CallbackQuery</c> property. Without these attributes the text flow still works
/// (<c>message</c>, <c>chat</c>, <c>text</c> are single words) while <b>every inline-button tap is
/// silently dropped</b>: no error, no log line, just a bot that stops responding the moment a voter taps
/// an election. Tests that build these records in C# cannot catch it — only a test that deserialises a
/// real payload can, which is what <c>BaleWireContractTests</c> is for.
/// </para>
/// <para>
/// Nothing here is trusted as identity. <c>Chat.Id</c> says which conversation this is, never who the
/// person is — anyone can open a chat. Identity comes from the کد ملی plus an OTP sent to the mobile the
/// organisation has on record.
/// </para>
/// </remarks>
public sealed record BaleUpdate(
    [property: JsonPropertyName("update_id")] long UpdateId,
    [property: JsonPropertyName("message")] BaleMessage? Message,
    [property: JsonPropertyName("callback_query")] BaleCallbackQuery? CallbackQuery);

public sealed record BaleMessage(
    [property: JsonPropertyName("message_id")] long MessageId,
    [property: JsonPropertyName("chat")] BaleChat? Chat,
    [property: JsonPropertyName("text")] string? Text);

/// <summary>
/// A conversation.
/// </summary>
/// <remarks>
/// <see cref="Type"/> matters: in a <c>group</c> or <c>supergroup</c> every member sees every message and
/// they would all share one session, so one person could identify and the rest could vote as them. The
/// bot refuses anything that is not a private chat.
/// </remarks>
public sealed record BaleChat(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("type")] string? Type);

public sealed record BaleCallbackQuery(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("message")] BaleMessage? Message,
    [property: JsonPropertyName("data")] string? Data);
