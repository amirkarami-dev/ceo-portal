using Mabhas19.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Analytics;

public class AiProviderConfiguration : IEntityTypeConfiguration<AiProvider>
{
    public void Configure(EntityTypeBuilder<AiProvider> builder)
    {
        builder.ToTable("AnalyticsAiProviders");

        builder.Property(p => p.TenantId).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Type).HasMaxLength(100).IsRequired();
        // ConfigJson MUST NOT contain raw secrets — key references only.
        builder.Property(p => p.ConfigJson).HasColumnType("nvarchar(max)").IsRequired();

        builder.HasIndex(p => p.TenantId);
    }
}
