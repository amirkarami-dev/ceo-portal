namespace Mabhas19.Domain.Constants;

public abstract class Roles
{
    /// <summary>Full access: manage users and their subscriptions.</summary>
    public const string Administrator = nameof(Administrator);

    /// <summary>
    /// Strictly above <see cref="Administrator"/>: everything an administrator can do, and never
    /// restricted by per-service grants.
    /// </summary>
    /// <remarks>
    /// It exists so that granting services to an administrator can be made restrictive without
    /// creating a way to lock every human out. An administrator whose grant list omitted the admin
    /// panel would otherwise lose the one screen able to undo that — repairable only by editing the
    /// database directly. A SuperUser can always get back in and fix it.
    /// <para>
    /// The identity provider cannot see this file: <c>src/Auth</c> references only
    /// <c>ServiceDefaults</c>, so it repeats the literal in <c>AuthDbInitialiser</c> and
    /// <c>AdminController</c>. Change one, change all three.
    /// </para>
    /// </remarks>
    public const string SuperUser = nameof(SuperUser);

    /// <summary>Default role for registered end users.</summary>
    public const string User = nameof(User);

    /// <summary>
    /// For <c>[Authorize(Roles = …)]</c>, which takes a single comma-separated string.
    /// </summary>
    /// <remarks>
    /// <b>No space after the comma.</b> <c>AuthorizationBehaviour</c> does <c>a.Roles.Split(',')</c>
    /// and then compares with <c>role == x</c> — it never trims, so <c>"Administrator, SuperUser"</c>
    /// would silently match nobody at all.
    /// </remarks>
    public const string AdminOrSuper = Administrator + "," + SuperUser;

    public static readonly string[] All = { Administrator, SuperUser, User };

    /// <summary>
    /// True when this role set carries administrator powers. Use it instead of testing for
    /// <see cref="Administrator"/> directly, or a SuperUser silently behaves like an ordinary user.
    /// </summary>
    public static bool HasAdminPowers(IEnumerable<string>? roles) =>
        roles is not null && roles.Any(r => r == Administrator || r == SuperUser);
}
