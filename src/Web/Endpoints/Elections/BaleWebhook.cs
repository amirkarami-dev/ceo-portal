using Mabhas19.Application.Elections.Bale;
using Mabhas19.Infrastructure.Elections;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace Mabhas19.Web.Endpoints.Elections;

/// <summary>
/// The Bale bot webhook. Auto-mapped to <c>/api/BaleWebhook</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Anonymous, and it has to be.</b> Bale posts here with no bearer token. The unguessable path segment
/// keeps scanners out, but it is <b>not</b> authentication: <c>getWebhookInfo</c> returns the full URL and
/// it appears in every reverse-proxy access log line. What actually protects a vote is that casting
/// requires a <b>fresh OTP to the mobile the organisation has on record</b> — so somebody holding this URL
/// can make the bot talk, and nothing else.
/// </para>
/// <para>
/// <b>Always answers 200.</b> Bale re-delivers an update it gets no 200 for, and a re-delivered update
/// would replay whatever the user's last message triggered. Failures are reported to the user in the chat,
/// never as a status code.
/// </para>
/// <para>
/// Registered once with a <c>curl</c> to <c>setWebhook</c> — there is deliberately no registrar service,
/// no long-polling worker and no admin endpoints for it. See the design, §8.
/// </para>
/// </remarks>
public class BaleWebhook : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/BaleWebhook";

    /// <summary>Set by Bale when <c>setWebhook</c> is given a secret; checked when one is configured.</summary>
    private const string SecretHeader = "X-Bale-Webhook-Secret";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(ReceiveUpdate, "{path}").AllowAnonymous();
    }

    /// <param name="path">
    /// The configured <c>Bale:WebhookPath</c>. A route parameter rather than a query string so it never
    /// lands in a query-string log, and compared in fixed time so the endpoint cannot be probed
    /// character by character.
    /// </param>
    public static async Task<Results<Ok, NotFound>> ReceiveUpdate(
        ISender sender,
        IOptions<BaleOptions> options,
        HttpContext http,
        string path,
        BaleUpdate update,
        CancellationToken cancellationToken)
    {
        var config = options.Value;

        // No token, no bot. Refusing here rather than letting the handler run means a half-configured
        // deployment cannot start conversations it can never reply to.
        if (string.IsNullOrWhiteSpace(config.BotToken) || string.IsNullOrWhiteSpace(config.WebhookPath))
        {
            return TypedResults.NotFound();
        }

        // NotFound rather than Unauthorized for every rejection: a 401 confirms that something is
        // listening on this route, which is the one thing an unguessable path is meant to hide.
        if (!FixedTimeEquals(path, config.WebhookPath))
        {
            return TypedResults.NotFound();
        }

        if (!string.IsNullOrWhiteSpace(config.WebhookSecret))
        {
            var supplied = http.Request.Headers[SecretHeader].ToString();
            if (!FixedTimeEquals(supplied, config.WebhookSecret))
            {
                return TypedResults.NotFound();
            }
        }

        await sender.Send(new HandleBaleUpdateCommand(update), cancellationToken);

        return TypedResults.Ok();
    }

    /// <summary>Length-independent comparison, so a timing difference cannot reveal the path.</summary>
    private static bool FixedTimeEquals(string? supplied, string expected)
    {
        if (string.IsNullOrEmpty(supplied))
        {
            return false;
        }

        var a = System.Text.Encoding.UTF8.GetBytes(supplied);
        var b = System.Text.Encoding.UTF8.GetBytes(expected);

        // FixedTimeEquals requires equal lengths; hashing both first makes the comparison itself
        // constant-time regardless of what was supplied.
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
            System.Security.Cryptography.SHA256.HashData(a),
            System.Security.Cryptography.SHA256.HashData(b));
    }
}
