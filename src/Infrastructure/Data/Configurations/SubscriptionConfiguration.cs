using Mabhas19.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations;

public class SubscriptionConfiguration : IEntityTypeConfiguration<Subscription>
{
    public void Configure(EntityTypeBuilder<Subscription> builder)
    {
        builder.Property(s => s.UserId).HasMaxLength(450).IsRequired();
        builder.Property(s => s.Plan).HasConversion<int>();

        builder.HasIndex(s => s.UserId).IsUnique();
    }
}
