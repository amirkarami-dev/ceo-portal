using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Rooms;

public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> b)
    {
        b.ToTable("Rooms", t =>
        {
            // These three are the whole type system of this feature, and they are in SQL rather than
            // only in a validator because every one of them is a security rule, not a tidiness rule.

            // A public link into an equal-footing meeting would let a stranger switch a camera on in a
            // committee room. Public is only ever a presentation, where the audience cannot publish.
            t.HasCheckConstraint(
                "CK_Rooms_PublicIsPresentationOnly",
                "[JoinMode] <> 2 OR [Type] = 1");

            // A presentation with no presenter is a room where nobody can speak.
            t.HasCheckConstraint(
                "CK_Rooms_PresentationNeedsPresenter",
                "[Type] <> 1 OR [PresenterUserId] IS NOT NULL");

            // A link-joined meeting needs a link; an invite-only one must not have a dangling secret.
            t.HasCheckConstraint(
                "CK_Rooms_JoinTokenMatchesMode",
                "([JoinMode] = 0 AND [JoinToken] IS NULL) OR ([JoinMode] <> 0 AND [JoinToken] IS NOT NULL)");

            // Invite-only is a Meeting concept; a presentation is reached by link.
            t.HasCheckConstraint(
                "CK_Rooms_InviteOnlyIsMeetingOnly",
                "[JoinMode] <> 0 OR [Type] = 0");

            t.HasCheckConstraint("CK_Rooms_MaxParticipants", "[MaxParticipants] >= 1");
            t.HasCheckConstraint("CK_Rooms_EarlyJoin", "[EarlyJoinMinutes] >= 0");
        });

        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);

        // ceo-{8 hex}. Unique because it IS the media-server room name — two rows sharing a slug would
        // put two different meetings in the same live room.
        b.Property(x => x.Slug).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.Slug).IsUnique();

        // 32 hex. Unique and indexed: every link visit looks a room up by this and nothing else, so it
        // must be fast and it must never be ambiguous.
        b.Property(x => x.JoinToken).HasMaxLength(64);
        b.HasIndex(x => x.JoinToken)
            .IsUnique()
            .HasFilter("[JoinToken] IS NOT NULL");

        b.Property(x => x.PresenterUserId).HasMaxLength(64);
        b.Property(x => x.PresenterName).HasMaxLength(200);

        // To the second. A meeting start time is not a sub-second quantity, and it is compared
        // against a clock.
        b.Property(x => x.StartsAtUtc).HasPrecision(0);

        // The list every attendee lands on.
        b.HasIndex(x => new { x.IsDeleted, x.IsActive, x.StartsAtUtc });
    }
}

public class RoomInviteConfiguration : IEntityTypeConfiguration<RoomInvite>
{
    public void Configure(EntityTypeBuilder<RoomInvite> b)
    {
        b.ToTable("RoomInvites");

        b.Property(x => x.UserId).HasMaxLength(64).IsRequired();
        b.Property(x => x.UserName).HasMaxLength(200);

        // One invite per person per meeting. Inviting twice is an admin slip, not an error worth a 500,
        // so the handler treats a duplicate as a no-op — but the database is what guarantees it.
        b.HasIndex(x => new { x.RoomId, x.UserId }).IsUnique();

        b.HasOne(x => x.Room)
            .WithMany(x => x.Invites)
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class RoomMessageConfiguration : IEntityTypeConfiguration<RoomMessage>
{
    public void Configure(EntityTypeBuilder<RoomMessage> b)
    {
        b.ToTable("RoomMessages");

        b.Property(x => x.SenderId).HasMaxLength(64).IsRequired();
        b.Property(x => x.SenderName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Text).HasMaxLength(4000).IsRequired();

        // History is always read newest-first for one room.
        b.HasIndex(x => new { x.RoomId, x.Created });

        b.HasOne(x => x.Room)
            .WithMany()
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
