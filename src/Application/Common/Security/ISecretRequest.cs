namespace Mabhas19.Application.Common.Security;

/// <summary>
/// Marks a request whose very OCCURRENCE is confidential — not just its contents.
/// </summary>
/// <remarks>
/// <para>
/// The logging behaviours write <c>{Name} {@UserId} {@UserName} {@Request}</c>. For engineer accounts
/// <b>the username IS the کد ملی</b> (the IdP uses it as the login name — see
/// <c>GetWalfareEngineerMeQueryHandler</c>), so for a vote that single line is a timestamped,
/// ordered voter roll sitting in the application log — which is usually protected less carefully than
/// the database. Pair it with the ballot table's insert order and you learn how each person voted
/// without breaking any encryption at all.
/// </para>
/// <para>
/// So suppressing <c>{@Request}</c> alone is NOT enough: the request name plus the username plus the
/// millisecond timestamp is already the roll. A request marked with this interface must produce
/// <b>no log line at all</b> from <c>LoggingBehaviour</c> and <c>PerformanceBehaviour</c>, and its
/// exceptions must be logged without the user or the payload.
/// </para>
/// <para>
/// Use this only where the fact that a specific person acted must stay secret. It is not a general
/// "sensitive data" marker — losing observability is a real cost, and for a vote it is the correct
/// trade.
/// </para>
/// </remarks>
public interface ISecretRequest;
