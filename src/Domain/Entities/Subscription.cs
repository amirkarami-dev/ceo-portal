using Mabhas19.Domain.Enums;

namespace Mabhas19.Domain.Entities;

/// <summary>
/// A user's subscription record. The per-user project cap is no longer enforced —
/// active users may create unlimited projects — so <see cref="MaxProjects"/> is retained
/// for admin display/management only. Every registered user gets a Free plan by default.
/// </summary>
public class Subscription : BaseAuditableEntity
{
    public const int DefaultMaxProjects = 5;

    public required string UserId { get; set; }

    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Free;

    public int MaxProjects { get; set; } = DefaultMaxProjects;

    public DateTimeOffset? ValidFrom { get; set; }

    public DateTimeOffset? ValidTo { get; set; }

    public bool IsActive { get; set; } = true;
}
