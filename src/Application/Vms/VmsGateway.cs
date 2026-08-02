using System.Globalization;
using System.Text;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Vms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Vms;

/// <summary>
/// The shared secret the media gateway presents when it asks for its configuration.
/// </summary>
/// <remarks>
/// <para>
/// There is no client-credentials flow in the IdP and no API-key middleware in this API, so this
/// follows the one machine-to-machine pattern the repo already has: a long random value in
/// <c>deploy/.env</c>, compared in fixed time. See <c>BaleWebhook</c>.
/// </para>
/// <para>
/// <b>Empty means refuse everything.</b> A half-configured deployment must not serve the camera
/// inventory to anybody who asks — the same fail-closed rule as an empty LiveKit secret.
/// </para>
/// </remarks>
public sealed class VmsGatewayOptions
{
    public const string SectionName = "Vms";

    /// <summary>The gateway's token. Not a password, not a camera credential — just this one route.</summary>
    public string GatewayToken { get; init; } = string.Empty;
}

/// <summary>
/// What the media VPS needs in order to write go2rtc's configuration.
/// </summary>
/// <remarks>
/// <see cref="StreamsYaml"/> is the <c>streams:</c> block only. Listen addresses, logging and TLS are
/// the VPS's business and stay in a base file there; cameras are the database's business and come from
/// here. Neither side has to know the other's half.
/// </remarks>
public sealed record VmsGatewayConfigDto(
    DateTimeOffset GeneratedAtUtc,
    int CameraCount,
    /// <summary>Every credential the block refers to. The agent checks it holds all of them first.</summary>
    IReadOnlyList<string> CredentialKeys,
    string StreamsYaml);

/// <summary>
/// Renders the go2rtc <c>streams:</c> block for a set of cameras.
/// </summary>
/// <remarks>
/// <para>
/// Pure and in C# on purpose. The RTSP path spelling — <c>/mode=real&amp;idc=N&amp;ids=M</c> — was not
/// guessable and had to be read out of the camera's own JavaScript (step 1). It must exist in exactly
/// one place, under test, and never be retyped in a shell script.
/// </para>
/// <para>
/// Credentials are left as <c>{{cred:key}}</c> placeholders. The database has no passwords to put
/// there, and the substitution happens on the VPS, which is the only machine that holds them.
/// </para>
/// </remarks>
public static class Go2RtcConfig
{
    /// <summary>Marks where the VPS substitutes <c>user:urlencoded-password</c>.</summary>
    public static string Placeholder(string credentialKey) => $"{{{{cred:{credentialKey}}}}}";

    public static string Render(IEnumerable<Camera> cameras)
    {
        var sb = new StringBuilder();
        sb.Append("streams:\n");

        var any = false;

        foreach (var camera in cameras.OrderBy(c => c.StreamKey, StringComparer.Ordinal))
        {
            any = true;

            // Single-quoted, because the URL contains '&' and ':' and go2rtc reads real YAML. The
            // substituted credential must be URL-encoded, which is also what keeps a password
            // containing an apostrophe from breaking out of this scalar.
            sb.Append("  ")
              .Append(camera.StreamKey)
              .Append(": '")
              .Append(Url(camera, camera.SubStreamId))
              .Append("'\n");

            // A second entry only when the site can actually carry the main stream. On the estate
            // measured so far it cannot — see the design, §2.2 — so this is usually absent.
            if (camera.MainStreamId is { } main)
            {
                sb.Append("  ")
                  .Append(camera.StreamKey)
                  .Append("-main: '")
                  .Append(Url(camera, main))
                  .Append("'\n");
            }
        }

        if (!any)
        {
            // go2rtc rejects a bare "streams:" with nothing under it, and an empty file would leave
            // the previous cameras running with no sign that the list is now empty.
            sb.Append("  {}\n");
        }

        return sb.ToString();
    }

    private static string Url(Camera camera, int streamId) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"rtsp://{Placeholder(camera.CredentialKey)}@{camera.Host}:{camera.RtspPort}{camera.StreamPath(streamId)}");
}

/// <summary>
/// The camera inventory, as go2rtc configuration.
/// </summary>
/// <remarks>
/// <b>Deliberately not <c>[Authorize]</c>.</b> The caller is a machine with no OIDC identity. The only
/// route that reaches this is <c>/api/VmsGateway</c>, which checks the shared token before sending —
/// so do not add another caller without repeating that check.
/// </remarks>
public record GetVmsGatewayConfigQuery : IRequest<VmsGatewayConfigDto>;

public class GetVmsGatewayConfigQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetVmsGatewayConfigQuery, VmsGatewayConfigDto>
{
    public async Task<VmsGatewayConfigDto> Handle(
        GetVmsGatewayConfigQuery request, CancellationToken cancellationToken)
    {
        // Switched-off and deleted cameras are simply absent. go2rtc only ever connects to a camera
        // somebody is watching, but a stream it does not know about cannot be watched at all — which
        // is what "switched off" has to mean.
        var cameras = await context.VmsCameras
            .Where(x => !x.IsDeleted && x.IsActive)
            .OrderBy(x => x.StreamKey)
            .ToListAsync(cancellationToken);

        var keys = cameras
            .Select(x => x.CredentialKey)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        return new VmsGatewayConfigDto(
            clock.GetUtcNow(),
            cameras.Count,
            keys,
            Go2RtcConfig.Render(cameras));
    }
}
