using Mabhas19.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations;

public class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.Property(p => p.Title).HasMaxLength(200).IsRequired();
        builder.Property(p => p.Client).HasMaxLength(200);
        builder.Property(p => p.Address).HasMaxLength(500);
        builder.Property(p => p.City).HasMaxLength(100);
        builder.Property(p => p.ClimateCode).HasMaxLength(8).IsRequired();
        builder.Property(p => p.Usage).HasMaxLength(200);
        builder.Property(p => p.Deed).HasMaxLength(100);
        builder.Property(p => p.Parcel).HasMaxLength(100);
        builder.Property(p => p.SystemId).HasMaxLength(100);
        builder.Property(p => p.OwnerId).HasMaxLength(450).IsRequired();
        builder.Property(p => p.ExternalId).HasMaxLength(200);
        builder.Property(p => p.AllowedSections).HasMaxLength(100);
        builder.Property(p => p.Source).HasConversion<int>();

        builder.HasIndex(p => p.OwnerId);

        // Computed from dimensions; never persisted.
        builder.Ignore(p => p.BuildingGroup);

        builder.HasOne(p => p.Assessment)
            .WithOne(a => a.Project)
            .HasForeignKey<Assessment>(a => a.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
