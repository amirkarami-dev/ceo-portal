using Mabhas19.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Analytics;

public class AnalyticsReportConfiguration : IEntityTypeConfiguration<AnalyticsReport>
{
    public void Configure(EntityTypeBuilder<AnalyticsReport> builder)
    {
        builder.ToTable("AnalyticsReports");

        builder.Property(r => r.TenantId).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Name).HasMaxLength(300).IsRequired();
        builder.Property(r => r.DefinitionJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(r => r.OwnerName).HasMaxLength(256);
        builder.Property(r => r.Visibility).HasMaxLength(20).IsRequired();

        builder.HasIndex(r => r.TenantId);
    }
}
