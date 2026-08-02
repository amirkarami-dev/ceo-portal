using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Vms;

/// <summary>
/// A city a camera can sit in — بانه، مریوان، سقز، دهگلان، کامیاران، قروه، بیجار، دیواندره.
/// </summary>
/// <remarks>
/// <para>
/// This is a **table, not a C# enum**, and that is the whole point. The election service froze the
/// engineering disciplines into a fixed list and then met six members carrying `Reshte = 8`, a code
/// with no name and no option in the admin picker. A list that belongs to the organisation must be
/// something the organisation can extend without a deployment.
/// </para>
/// <para>
/// <see cref="Code"/> is the stable identity — <see cref="Camera.CityCode"/> points at it, not at
/// <see cref="BaseEntity.Id"/>. A code is readable in a query, survives a reseed, and reads sensibly
/// in a go2rtc stream name (<c>baneh-01</c>).
/// </para>
/// </remarks>
public class VmsCity : BaseAuditableEntity
{
    /// <summary>Unique, lower-case ASCII: <c>baneh</c>, <c>marivan</c>, …</summary>
    public required string Code { get; set; }

    /// <summary>The Persian name shown in the UI.</summary>
    public required string Name { get; set; }

    /// <summary>Ordering in the city list. Ties fall back to <see cref="Name"/>.</summary>
    public int DisplayOrder { get; set; }

    /// <summary>False hides the city from the picker. Existing cameras keep pointing at it.</summary>
    public bool IsActive { get; set; } = true;

    public IList<Camera> Cameras { get; init; } = new List<Camera>();
}

/// <summary>
/// One IP camera, tagged with the city it sits in.
/// </summary>
/// <remarks>
/// <para>
/// <b>No password is stored here.</b> The row carries <see cref="CredentialKey"/>, which names an
/// entry in a secrets file that lives only on the media VPS. Step 4 generates go2rtc's config by
/// joining the two, so the database can describe every camera without ever being able to open one.
/// A `CeoDb` backup, a query, or an over-broad API response therefore cannot leak a camera.
/// </para>
/// <para>
/// <see cref="MainStreamId"/> is nullable and usually null, which is a fact about the estate rather
/// than a missing value: the first camera's main stream is 2560×1440 at ~11.2 Mbit/s against a site
/// uplink of ~0.41 Mbit/s, so it cannot be watched at all. Only the substream is viewable. Null means
/// "this site cannot carry the main stream"; a value means it has been measured and it can.
/// </para>
/// </remarks>
public class Camera : BaseAuditableEntity
{
    /// <summary>«دوربین ورودی شهرداری».</summary>
    public required string Name { get; set; }

    /// <summary><see cref="VmsCity.Code"/>. Classification and filtering — never a permission.</summary>
    public required string CityCode { get; set; }

    public VmsCity? City { get; set; }

    /// <summary>The camera's address, e.g. <c>78.39.233.70</c> or a hostname.</summary>
    public required string Host { get; set; }

    public int RtspPort { get; set; } = 554;

    /// <summary>
    /// The go2rtc stream name, e.g. <c>baneh-01</c>. Unique, because it is the key browsers ask for.
    /// </summary>
    /// <remarks>Not a URL and not a secret — it is safe to put in a page.</remarks>
    public required string StreamKey { get; set; }

    /// <summary>
    /// Names the credential on the VPS. Cameras that share one login share one key.
    /// </summary>
    /// <remarks>Never the password itself. See the class remarks.</remarks>
    public string CredentialKey { get; set; } = "default";

    /// <summary>The <c>idc</c> of the RTSP path. 1 on a single-sensor camera.</summary>
    public int Channel { get; set; } = 1;

    /// <summary>The <c>ids</c> of the substream — the only stream the grid ever shows.</summary>
    public int SubStreamId { get; set; } = 2;

    /// <summary>The <c>ids</c> of the main stream, or null when the site's uplink cannot carry it.</summary>
    public int? MainStreamId { get; set; }

    /// <summary>False stops it being served. It stays in the admin list.</summary>
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    /// <summary>
    /// Written by the scheduled health sweep, read by the UI.
    /// </summary>
    /// <remarks>
    /// Never probed on page load. Twenty cameras would mean twenty outbound connections per visit,
    /// and a probe is a *second* puller against a link that only has room for one.
    /// </remarks>
    public DateTimeOffset? LastSeenUtc { get; set; }

    public string? Notes { get; set; }

    /// <summary>The RTSP path for a stream id, without scheme, credentials or host.</summary>
    /// <remarks>
    /// Kept next to the data it is built from so there is one spelling of it. Discovered from the
    /// camera's own <c>js/Common.js</c>; see the step 1 worklog for why it could not be guessed.
    /// </remarks>
    public string StreamPath(int streamId) =>
        $"/mode=real&idc={Channel}&ids={streamId}";

    /// <summary>True when the grid can show this camera.</summary>
    public bool IsViewable => IsActive && !IsDeleted;
}
