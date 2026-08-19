namespace Mabhas19.Application.Common.Security;

/// <summary>
/// Marks a request whose CONTENTS must never be written to the application log, although the fact
/// that it happened, and who did it, may be.
/// </summary>
/// <remarks>
/// <para>
/// <c>LoggingBehaviour</c> writes <c>{Name} {@UserId} {@UserName} {@Request}</c> for every request,
/// and <c>UnhandledExceptionBehaviour</c> repeats <c>{@Request}</c> when one faults. That is good
/// observability for most requests and the wrong trade for a few, because the payload itself is the
/// secret:
/// </para>
/// <list type="bullet">
///   <item><description>a کد ملی, a mobile number and companion names on a guesthouse request —
///   personal data of someone who may not even hold an account;</description></item>
///   <item><description>a guesthouse <b>payment token</b>, which is a bearer credential. Anyone
///   reading it can open the payment page, and re-pricing revives an expired one, so a token logged
///   while dead can become live again.</description></item>
/// </list>
/// <para>
/// This is deliberately NOT <see cref="ISecretRequest"/>. That one exists because the very
/// occurrence of a request must stay secret — a vote — so it suppresses the whole log line, name and
/// user included. Here the opposite is true: knowing that someone submitted a guesthouse request is
/// exactly what an audit trail should show. Only the payload comes out.
/// </para>
/// <para>
/// Cost of using it: a fault in one of these handlers is diagnosed without the request body. Prefer
/// it anyway wherever the payload carries an identifier or a credential — a log file is usually
/// protected far less carefully than the database the same values live in.
/// </para>
/// </remarks>
public interface ISensitivePayloadRequest;
