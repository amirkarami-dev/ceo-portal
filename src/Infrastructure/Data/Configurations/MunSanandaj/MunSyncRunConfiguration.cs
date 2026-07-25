using Mabhas19.Domain.MunSanandaj;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.MunSanandaj;

public class MunSyncRunConfiguration : IEntityTypeConfiguration<MunSyncRun>
{
    public void Configure(EntityTypeBuilder<MunSyncRun> builder)
    {
        builder.ToTable("mun_sync_runs");

        builder.Property(r => r.WorkerType).HasConversion<int>();
        builder.Property(r => r.Status).HasConversion<int>();
        builder.Property(r => r.TriggeredBy).HasConversion<int>();
        builder.Property(r => r.TriggeredByUser).HasMaxLength(256);

        builder.HasIndex(r => r.RunId).IsUnique();
        builder.HasIndex(r => r.StartedAt);
    }
}
