using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// One page view, recorded so the footer's visit counters (total / today / online) are real
/// instead of the hard-coded Persian-numeral strings the mock shipped with.
/// </summary>
/// <remarks>
/// "Online" is derived as the number of distinct <see cref="SessionId"/> values seen within a
/// short recency window. <see cref="SessionId"/> is an opaque client-generated id — no IP address
/// or other personal data is stored.
/// </remarks>
public class KurdnezamVisit : BaseEntity
{
    public DateTimeOffset VisitedAt { get; set; }

    /// <summary>Opaque per-browser session id (not personally identifying).</summary>
    public string SessionId { get; set; } = string.Empty;

    /// <summary>The site path that was viewed.</summary>
    public string Path { get; set; } = string.Empty;
}
