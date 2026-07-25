using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Kurdnezam;

public class KurdnezamSettingsConfiguration : IEntityTypeConfiguration<KurdnezamSettings>
{
    public void Configure(EntityTypeBuilder<KurdnezamSettings> b)
    {
        b.ToTable("KurdnezamSettings");

        b.Property(x => x.NameFa).HasMaxLength(300).IsRequired();
        b.Property(x => x.NameKu).HasMaxLength(300).IsRequired();
        b.Property(x => x.NameEn).HasMaxLength(300).IsRequired();
        b.Property(x => x.Tagline).HasMaxLength(500).IsRequired();
        b.Property(x => x.Address).HasMaxLength(1000).IsRequired();
        b.Property(x => x.PhonesJson).HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.PostalCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.Telegram).HasMaxLength(500).IsRequired();
        b.Property(x => x.Instagram).HasMaxLength(500).IsRequired();
    }
}

public class KurdnezamFooterLinkConfiguration : IEntityTypeConfiguration<KurdnezamFooterLink>
{
    public void Configure(EntityTypeBuilder<KurdnezamFooterLink> b)
    {
        b.ToTable("KurdnezamFooterLinks");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Href).HasMaxLength(1000).IsRequired();

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamCategoryConfiguration : IEntityTypeConfiguration<KurdnezamCategory>
{
    public void Configure(EntityTypeBuilder<KurdnezamCategory> b)
    {
        b.ToTable("KurdnezamCategories");

        b.Property(x => x.Title).HasMaxLength(200).IsRequired();

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamNewsConfiguration : IEntityTypeConfiguration<KurdnezamNews>
{
    public void Configure(EntityTypeBuilder<KurdnezamNews> b)
    {
        b.ToTable("KurdnezamNews");

        b.Property(x => x.Title).HasMaxLength(500).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Body).HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.DateJalali).HasMaxLength(30).IsRequired();
        b.Property(x => x.Author).HasMaxLength(200).IsRequired();
        b.Property(x => x.Image).HasMaxLength(1000).IsRequired();

        // Keep articles when a category is removed would orphan them, so block the delete instead.
        b.HasOne(x => x.Category)
            .WithMany(c => c.News)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // A unit can be deleted without taking its news with it.
        b.HasOne(x => x.Unit)
            .WithMany(u => u.News)
            .HasForeignKey(x => x.UnitId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => x.CategoryId);
        b.HasIndex(x => x.UnitId);
        b.HasIndex(x => x.Featured);
        b.HasIndex(x => x.PublishedAt);
    }
}

public class KurdnezamNewsAttachmentConfiguration : IEntityTypeConfiguration<KurdnezamNewsAttachment>
{
    public void Configure(EntityTypeBuilder<KurdnezamNewsAttachment> b)
    {
        b.ToTable("KurdnezamNewsAttachments");

        b.Property(x => x.Url).HasMaxLength(1000).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(300).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(150).IsRequired();

        // Attachments belong to their article: removing the article removes its files' rows.
        b.HasOne(x => x.News)
            .WithMany(n => n.Attachments)
            .HasForeignKey(x => x.NewsId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => new { x.NewsId, x.SortOrder });
    }
}

public class KurdnezamSlideConfiguration : IEntityTypeConfiguration<KurdnezamSlide>
{
    public void Configure(EntityTypeBuilder<KurdnezamSlide> b)
    {
        b.ToTable("KurdnezamSlides");

        b.Property(x => x.Title).HasMaxLength(500).IsRequired();
        b.Property(x => x.Subtitle).HasMaxLength(500).IsRequired();
        b.Property(x => x.Image).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Badge).HasMaxLength(200).IsRequired();

        // Deleting the target article must not silently delete the slide — block it so an
        // administrator has to repoint the slide first.
        b.HasOne(x => x.News)
            .WithMany()
            .HasForeignKey(x => x.NewsId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamQuickLinkConfiguration : IEntityTypeConfiguration<KurdnezamQuickLink>
{
    public void Configure(EntityTypeBuilder<KurdnezamQuickLink> b)
    {
        b.ToTable("KurdnezamQuickLinks");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Href).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Icon).HasMaxLength(50).IsRequired();

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamPersonConfiguration : IEntityTypeConfiguration<KurdnezamPerson>
{
    public void Configure(EntityTypeBuilder<KurdnezamPerson> b)
    {
        b.ToTable("KurdnezamPeople");

        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Role).HasMaxLength(200).IsRequired();
        b.Property(x => x.Image).HasMaxLength(1000);
        b.Property(x => x.Group).HasMaxLength(50).IsRequired();

        b.HasIndex(x => x.Group);
        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamUnitConfiguration : IEntityTypeConfiguration<KurdnezamUnit>
{
    public void Configure(EntityTypeBuilder<KurdnezamUnit> b)
    {
        b.ToTable("KurdnezamUnits");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Description).HasColumnType("nvarchar(max)").IsRequired();
        b.Property(x => x.HeadName).HasMaxLength(200);
        b.Property(x => x.HeadRole).HasMaxLength(200);

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamTabGroupConfiguration : IEntityTypeConfiguration<KurdnezamTabGroup>
{
    public void Configure(EntityTypeBuilder<KurdnezamTabGroup> b)
    {
        b.ToTable("KurdnezamTabGroups");

        b.Property(x => x.Slug).HasMaxLength(100).IsRequired();
        b.Property(x => x.Title).HasMaxLength(300).IsRequired();

        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamTabItemConfiguration : IEntityTypeConfiguration<KurdnezamTabItem>
{
    public void Configure(EntityTypeBuilder<KurdnezamTabItem> b)
    {
        b.ToTable("KurdnezamTabItems");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Href).HasMaxLength(1000);
        b.Property(x => x.Note).HasMaxLength(500);

        b.HasOne(x => x.TabGroup)
            .WithMany(g => g.Items)
            .HasForeignKey(x => x.TabGroupId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.TabGroupId);
    }
}

public class KurdnezamFormConfiguration : IEntityTypeConfiguration<KurdnezamForm>
{
    public void Configure(EntityTypeBuilder<KurdnezamForm> b)
    {
        b.ToTable("KurdnezamForms");

        b.Property(x => x.Title).HasMaxLength(500).IsRequired();
        b.Property(x => x.Note).HasMaxLength(1000).IsRequired();
        b.Property(x => x.Deadline).HasMaxLength(100).IsRequired();
        b.Property(x => x.Image).HasMaxLength(1000).IsRequired();

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamFormSubmissionConfiguration : IEntityTypeConfiguration<KurdnezamFormSubmission>
{
    public void Configure(EntityTypeBuilder<KurdnezamFormSubmission> b)
    {
        b.ToTable("KurdnezamFormSubmissions");

        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.NationalId).HasMaxLength(20).IsRequired();
        b.Property(x => x.MembershipNo).HasMaxLength(50).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(20).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(2000);

        b.HasOne(x => x.Form)
            .WithMany(f => f.Submissions)
            .HasForeignKey(x => x.FormId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.FormId);
        b.HasIndex(x => x.IsHandled);
    }
}

public class KurdnezamContactMessageConfiguration : IEntityTypeConfiguration<KurdnezamContactMessage>
{
    public void Configure(EntityTypeBuilder<KurdnezamContactMessage> b)
    {
        b.ToTable("KurdnezamContactMessages");

        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(30).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.Message).HasColumnType("nvarchar(max)").IsRequired();

        b.HasIndex(x => x.IsRead);
    }
}

public class KurdnezamOrgPageConfiguration : IEntityTypeConfiguration<KurdnezamOrgPage>
{
    public void Configure(EntityTypeBuilder<KurdnezamOrgPage> b)
    {
        b.ToTable("KurdnezamOrgPages");

        b.Property(x => x.Slug).HasMaxLength(100).IsRequired();
        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Group).HasMaxLength(50);
        b.Property(x => x.Intro).HasColumnType("nvarchar(max)").IsRequired();

        b.HasIndex(x => x.Slug).IsUnique();
    }
}

public class KurdnezamVisitConfiguration : IEntityTypeConfiguration<KurdnezamVisit>
{
    public void Configure(EntityTypeBuilder<KurdnezamVisit> b)
    {
        b.ToTable("KurdnezamVisits");

        b.Property(x => x.SessionId).HasMaxLength(64).IsRequired();
        b.Property(x => x.Path).HasMaxLength(500).IsRequired();

        // Drives the total / today / online counters.
        b.HasIndex(x => x.VisitedAt);
        b.HasIndex(x => new { x.SessionId, x.VisitedAt });
    }
}
