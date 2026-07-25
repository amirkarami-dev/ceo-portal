using Mabhas19.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Analytics;

public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("AnalyticsAuditEvents");

        builder.Property(e => e.TenantId).HasMaxLength(100).IsRequired();
        builder.Property(e => e.Type).HasMaxLength(200).IsRequired();
        builder.Property(e => e.ActorName).HasMaxLength(256);
        builder.Property(e => e.DetailJson).HasColumnType("nvarchar(max)").IsRequired();

        // Audit events are immutable — no update after insert.
        builder.HasIndex(e => e.TenantId);
        builder.HasIndex(e => e.OccurredAtUtc);
    }
}
