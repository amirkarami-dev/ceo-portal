using System.Security.Cryptography;
using System.Text;
using Mabhas19.Application.Vms;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace Mabhas19.Web.Endpoints.Vms;

/// <summary>
/// What the media VPS asks for when it rebuilds go2rtc's configuration.
/// Auto-mapped to <c>/api/VmsGateway</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Anonymous plus a shared token, because the caller is a machine.</b> The IdP has no
/// client-credentials flow and this API has no API-key middleware, so this follows the one
/// machine-to-machine pattern the repo already uses — a long random value in <c>deploy/.env</c>,
/// compared in fixed time. See <c>BaleWebhook</c>.
/// </para>
/// <para>
/// <b>401 here, unlike the Bale webhook's 404.</b> Bale's protection *is* an unguessable path, so
/// confirming the route exists would weaken it. This route's address is ordinary and its protection is
/// entirely the token, so hiding buys nothing and a clear status saves an operator guessing why the
/// sync fails.
/// </para>
/// <para>
/// <b>No camera password is ever returned</b>, because none is stored. Credentials appear as
/// <c>{{cred:key}}</c> placeholders that only the VPS can fill. What this does expose is the hosts and
/// ports of devices on private networks, which is why it is not public.
/// </para>
/// </remarks>
public class VmsGateway : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/VmsGateway";

    /// <summary>Carries the shared token. A header, not a query string, so it stays out of access logs.</summary>
    public const string TokenHeader = "X-Vms-Gateway-Token";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetVmsGatewayConfig, "config").AllowAnonymous();
    }

    public static async Task<Results<Ok<VmsGatewayConfigDto>, UnauthorizedHttpResult>> GetVmsGatewayConfig(
        ISender sender,
        IOptions<VmsGatewayOptions> options,
        HttpContext http,
        CancellationToken cancellationToken)
    {
        var expected = options.Value.GatewayToken;

        // Fail closed. An unconfigured deployment must not hand the camera inventory to anyone who
        // asks — the same rule as an empty LiveKit secret refusing to mint tokens.
        if (string.IsNullOrWhiteSpace(expected))
        {
            return TypedResults.Unauthorized();
        }

        if (!FixedTimeEquals(http.Request.Headers[TokenHeader].ToString(), expected))
        {
            return TypedResults.Unauthorized();
        }

        return TypedResults.Ok(await sender.Send(new GetVmsGatewayConfigQuery(), cancellationToken));
    }

    /// <summary>Length-independent comparison, so a timing difference cannot reveal the token.</summary>
    private static bool FixedTimeEquals(string? supplied, string expected)
    {
        if (string.IsNullOrEmpty(supplied))
        {
            return false;
        }

        // FixedTimeEquals needs equal lengths; hashing both first makes the comparison constant-time
        // whatever was supplied.
        return CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(Encoding.UTF8.GetBytes(supplied)),
            SHA256.HashData(Encoding.UTF8.GetBytes(expected)));
    }
}
