using Mabhas19.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations;

public class AssessmentReportConfiguration : IEntityTypeConfiguration<AssessmentReport>
{
    public void Configure(EntityTypeBuilder<AssessmentReport> builder)
    {
        builder.Property(r => r.StorageKey).HasMaxLength(500).IsRequired();
        builder.Property(r => r.FileName).HasMaxLength(300).IsRequired();
        builder.Property(r => r.ContentType).HasMaxLength(100);
    }
}
