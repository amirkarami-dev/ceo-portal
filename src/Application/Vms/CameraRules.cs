using System.Text;
using System.Text.RegularExpressions;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Vms;

/// <summary>
/// The rules a camera row has to satisfy, in one place and free of the database.
/// </summary>
/// <remarks>
/// Pure functions, so they can be tested without SQL Server and reused by both the validator and the
/// handlers. The messages are Persian because they are shown verbatim in the admin panel.
/// </remarks>
public static partial class CameraRules
{
    public const int MinPort = 1;
    public const int MaxPort = 65535;

    /// <summary>A hostname or an IPv4 address. No scheme, no port, no path.</summary>
    [GeneratedRegex(@"^[A-Za-z0-9]([A-Za-z0-9\-\.]{0,251}[A-Za-z0-9])?$")]
    private static partial Regex HostPattern();

    /// <summary>Lower-case ASCII words joined by hyphens: <c>baneh-01</c>, <c>default</c>.</summary>
    [GeneratedRegex(@"^[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();

    public static bool IsValidHost(string? host) =>
        !string.IsNullOrWhiteSpace(host) && host.Length <= 253 && HostPattern().IsMatch(host);

    public static bool IsValidSlug(string? slug) =>
        !string.IsNullOrWhiteSpace(slug) && slug.Length <= 64 && SlugPattern().IsMatch(slug);

    /// <summary>
    /// The go2rtc stream name for a camera: <c>{city}-{nn}</c>, e.g. <c>baneh-01</c>.
    /// </summary>
    /// <param name="taken">
    /// Every stream key already in use — <b>including soft-deleted cameras</b>. A key that came back
    /// after a delete would point a stale go2rtc entry, or a stale browser tab, at a different camera.
    /// </param>
    /// <remarks>
    /// Generated rather than typed. It ends up in go2rtc's config, in its logs and in the URL a browser
    /// asks for, so a typo is a camera that silently never appears; and it must be unique, which is not
    /// something an admin can check from a form.
    /// </remarks>
    public static string NextStreamKey(string cityCode, IEnumerable<string> taken)
    {
        var prefix = Sluggify(cityCode);
        var used = new HashSet<string>(taken, StringComparer.OrdinalIgnoreCase);

        for (var n = 1; n <= 999; n++)
        {
            var candidate = $"{prefix}-{n:00}";
            if (!used.Contains(candidate))
            {
                return candidate;
            }
        }

        // 999 cameras in one city is far outside the 20–100 the service was sized for, but a silent
        // duplicate here would be one camera serving another camera's picture.
        throw Invalid(
            "cityCode", "شمارهٔ آزادی برای نام پخش در این شهر یافت نشد؛ با پشتیبانی تماس بگیرید");
    }

    /// <summary>Lower-case ASCII slug of a code, for building a stream key.</summary>
    private static string Sluggify(string value)
    {
        var sb = new StringBuilder(value.Length);
        var lastWasDash = false;

        foreach (var c in value.Trim().ToLowerInvariant())
        {
            if (char.IsAsciiLetterOrDigit(c))
            {
                sb.Append(c);
                lastWasDash = false;
            }
            else if (sb.Length > 0 && !lastWasDash)
            {
                sb.Append('-');
                lastWasDash = true;
            }
        }

        var slug = sb.ToString().Trim('-');

        // A city code is already an ASCII slug by construction, so this only fires if somebody adds a
        // city whose code is Persian. "cam" keeps the key valid rather than producing "-01".
        return slug.Length > 0 ? slug : "cam";
    }

    public static ValidationException Invalid(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }
}
