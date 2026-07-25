using Mabhas19.Domain.MunSanandaj;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.MunSanandaj;

public class MunReportLogConfiguration : IEntityTypeConfiguration<MunReportLog>
{
    public void Configure(EntityTypeBuilder<MunReportLog> builder)
    {
        builder.ToTable("mun_report_logs");

        builder.Property(l => l.WorkerType).HasConversion<int>();
        builder.Property(l => l.Status).HasConversion<int>();
        builder.Property(l => l.Peygiri).HasMaxLength(64).IsRequired();
        builder.Property(l => l.ProjectNo).HasMaxLength(64).IsRequired();
        builder.Property(l => l.ReqId).HasMaxLength(64).IsRequired();
        builder.Property(l => l.Nosazi).HasMaxLength(64);
        builder.Property(l => l.RemoteSubmissionId).HasMaxLength(64);
        builder.Property(l => l.ResponseBody).HasColumnType("nvarchar(max)");
        builder.Property(l => l.ErrorMessage).HasMaxLength(1000);
        builder.Property(l => l.CreatedEngineerCodes).HasMaxLength(500);

        // Immutable, append-only — no update after insert (same rationale as AuditEventConfiguration).
        builder.HasIndex(l => l.RunId);
        builder.HasIndex(l => new { l.WorkerType, l.Peygiri, l.Id });
    }
}
