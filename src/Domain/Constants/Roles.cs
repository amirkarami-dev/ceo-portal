namespace Mabhas19.Domain.Constants;

public abstract class Roles
{
    /// <summary>Full access: manage users and their subscriptions.</summary>
    public const string Administrator = nameof(Administrator);

    /// <summary>Default role for registered end users.</summary>
    public const string User = nameof(User);

    public static readonly string[] All = { Administrator, User };
}
