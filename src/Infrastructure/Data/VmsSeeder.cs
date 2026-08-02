using Mabhas19.Domain.Vms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Infrastructure.Data;

/// <summary>
/// Seeds the eight cities the camera estate is spread across.
/// </summary>
/// <remarks>
/// <para>
/// Idempotent, and deliberately **all-or-nothing**: it inserts only when the table is empty. Topping
/// up missing codes instead would resurrect a city an admin had removed on purpose, every restart,
/// with no error to notice. Adding a ninth city is an INSERT by the admin, not a code change — which
/// is the reason this is a table rather than a C# enum in the first place.
/// </para>
/// <para>
/// Cameras are never seeded. A camera row carries a real address on a real network, so it belongs to
/// whoever is running the service, not to a migration.
/// </para>
/// </remarks>
internal static class VmsSeeder
{
    private static readonly (string Code, string Name)[] Cities =
    [
        ("baneh", "بانه"),
        ("marivan", "مریوان"),
        ("saqqez", "سقز"),
        ("dehgolan", "دهگلان"),
        ("kamyaran", "کامیاران"),
        ("qorveh", "قروه"),
        ("bijar", "بیجار"),
        ("divandarreh", "دیواندره"),
    ];

    public static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct = default)
    {
        if (await context.VmsCities.AnyAsync(ct))
        {
            return;
        }

        var order = 0;
        foreach (var (code, name) in Cities)
        {
            context.VmsCities.Add(new VmsCity
            {
                Code = code,
                Name = name,
                DisplayOrder = order += 10,
                IsActive = true
            });
        }

        await context.SaveChangesAsync(ct);
    }
}
