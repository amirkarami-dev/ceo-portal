using Mabhas19.Domain.Vms;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Vms;

public class VmsCityConfiguration : IEntityTypeConfiguration<VmsCity>
{
    public void Configure(EntityTypeBuilder<VmsCity> b)
    {
        b.ToTable("VmsCities");

        // Lower-case ASCII. Cameras point at the code rather than the id, so it is an alternate key
        // — declared here rather than as a unique index, because the FK on VmsCameras needs a key to
        // reference. An IsUnique() index alongside it would be a second identical index on the same
        // column, which SQL Server will happily create and then maintain for nothing.
        b.Property(x => x.Code).HasMaxLength(64).IsRequired();
        b.HasAlternateKey(x => x.Code);

        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
    }
}

public class CameraConfiguration : IEntityTypeConfiguration<Camera>
{
    public void Configure(EntityTypeBuilder<Camera> b)
    {
        b.ToTable("VmsCameras", t =>
        {
            t.HasCheckConstraint("CK_VmsCameras_RtspPort", "[RtspPort] BETWEEN 1 AND 65535");

            // idc/ids are indices into the camera's own stream table. Zero answered nothing on the
            // one device measured, and a negative index is meaningless everywhere.
            t.HasCheckConstraint("CK_VmsCameras_Channel", "[Channel] >= 1");
            t.HasCheckConstraint("CK_VmsCameras_SubStreamId", "[SubStreamId] >= 1");
            t.HasCheckConstraint(
                "CK_VmsCameras_MainStreamId",
                "[MainStreamId] IS NULL OR [MainStreamId] >= 1");

            // The main and the substream cannot be the same stream. If they were, "fullscreen shows
            // the main stream" would silently open a second session against a link that has room for
            // one — the failure would look like the camera dropping out, not like a config mistake.
            t.HasCheckConstraint(
                "CK_VmsCameras_StreamsDiffer",
                "[MainStreamId] IS NULL OR [MainStreamId] <> [SubStreamId]");
        });

        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Host).HasMaxLength(253).IsRequired();   // max DNS name length
        b.Property(x => x.Notes).HasMaxLength(1000);

        // The name browsers ask for. Unique: two cameras sharing it would put one behind the other.
        b.Property(x => x.StreamKey).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.StreamKey).IsUnique();

        // Names a credential held on the VPS. The password itself is never in this database — see
        // the remarks on Camera.
        b.Property(x => x.CredentialKey).HasMaxLength(64).IsRequired();

        b.Property(x => x.CityCode).HasMaxLength(64).IsRequired();

        // To the second: a last-seen stamp written by a sweep on a slow interval.
        b.Property(x => x.LastSeenUtc).HasPrecision(0);

        // By code rather than by id, so a row reads on its own and a reseed cannot silently
        // re-point cameras at a different city. Restrict, not Cascade: deleting a city must not
        // delete the cameras in it — the admin has to move them first.
        b.HasOne(x => x.City)
            .WithMany(x => x.Cameras)
            .HasForeignKey(x => x.CityCode)
            .HasPrincipalKey(x => x.Code)
            .OnDelete(DeleteBehavior.Restrict);

        // The one query the grid makes: live cameras in a city.
        b.HasIndex(x => new { x.IsDeleted, x.IsActive, x.CityCode });
    }
}
