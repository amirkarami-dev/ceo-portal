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
        b.Property(x => x.MapLabel).HasMaxLength(500).IsRequired().HasDefaultValue(string.Empty);
        b.Property(x => x.MapUrl).HasMaxLength(1000).IsRequired().HasDefaultValue(string.Empty);
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

        // Same rule for the attached form: removing the form must never remove the article. No
        // navigation back from the form — nothing needs to ask "which articles use me".
        b.HasOne(x => x.Form)
            .WithMany()
            .HasForeignKey(x => x.FormId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => x.CategoryId);
        b.HasIndex(x => x.UnitId);
        b.HasIndex(x => x.Featured);
        b.HasIndex(x => x.PublishedAt);
        b.HasIndex(x => x.FormId);
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
        b.Property(x => x.SuccessMessage).HasMaxLength(1000).IsRequired();

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamFormFieldConfiguration : IEntityTypeConfiguration<KurdnezamFormField>
{
    public void Configure(EntityTypeBuilder<KurdnezamFormField> b)
    {
        b.ToTable("KurdnezamFormFields");

        b.Property(x => x.Label).HasMaxLength(300).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.Help).HasMaxLength(500);

        // A field only exists as part of its form.
        b.HasOne(x => x.Form)
            .WithMany(f => f.Fields)
            .HasForeignKey(x => x.FormId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => new { x.FormId, x.SortOrder });

        // The validator refuses a bad kind first; this stops anything that reaches the database
        // another way, because the public page switches on this value to choose the input.
        b.ToTable(t => t.HasCheckConstraint(
            "CK_KurdnezamFormFields_Kind",
            $"[Kind] IN ({string.Join(", ", KurdnezamFormFieldKinds.All.Select(k => $"'{k}'"))})"));
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

public class KurdnezamFormAnswerConfiguration : IEntityTypeConfiguration<KurdnezamFormAnswer>
{
    public void Configure(EntityTypeBuilder<KurdnezamFormAnswer> b)
    {
        b.ToTable("KurdnezamFormAnswers");

        b.Property(x => x.FieldLabel).HasMaxLength(300).IsRequired();
        b.Property(x => x.Text).HasColumnType("nvarchar(max)").IsRequired();

        b.HasOne(x => x.Submission)
            .WithMany(s => s.Answers)
            .HasForeignKey(x => x.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.SubmissionId);

        // FieldId is deliberately NOT a foreign key — see the remarks on KurdnezamFormAnswer.
        // Indexed anyway, because the admin screen groups a submission's answers by field.
        b.HasIndex(x => x.FieldId);
    }
}

public class KurdnezamFormAttachmentConfiguration : IEntityTypeConfiguration<KurdnezamFormAttachment>
{
    public void Configure(EntityTypeBuilder<KurdnezamFormAttachment> b)
    {
        b.ToTable("KurdnezamFormAttachments");

        b.Property(x => x.FieldLabel).HasMaxLength(300).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(400).IsRequired();
        b.Property(x => x.StoredKey).HasMaxLength(400).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(200).IsRequired();

        b.HasOne(x => x.Submission)
            .WithMany(s => s.Attachments)
            .HasForeignKey(x => x.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.SubmissionId);
        b.HasIndex(x => x.FieldId);

        // One object per row. A unique key also means a retried submit can never register the same
        // stored object twice.
        b.HasIndex(x => x.StoredKey).IsUnique();
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

        // SetNull, not Cascade: a message is a record of something a member of the public did, and
        // it has to outlive the contact block it was addressed to.
        b.HasOne(x => x.Section)
            .WithMany()
            .HasForeignKey(x => x.SectionId)
            .OnDelete(DeleteBehavior.SetNull);

        b.HasIndex(x => x.IsRead);
        b.HasIndex(x => x.SectionId);
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
        b.Property(x => x.ParentSlug).HasMaxLength(100);
        b.Property(x => x.Icon).HasMaxLength(50);
        b.Property(x => x.Summary).HasMaxLength(500).IsRequired().HasDefaultValue(string.Empty);

        b.HasIndex(x => x.Slug).IsUnique();

        // The arkan page and the header dropdown both read "children of this slug, in order".
        b.HasIndex(x => new { x.ParentSlug, x.SortOrder });
    }
}

public class KurdnezamContactSectionConfiguration : IEntityTypeConfiguration<KurdnezamContactSection>
{
    public void Configure(EntityTypeBuilder<KurdnezamContactSection> b)
    {
        b.ToTable("KurdnezamContactSections");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.Icon).HasMaxLength(50);

        b.HasIndex(x => x.SortOrder);
    }
}

public class KurdnezamContactChannelConfiguration : IEntityTypeConfiguration<KurdnezamContactChannel>
{
    public void Configure(EntityTypeBuilder<KurdnezamContactChannel> b)
    {
        b.ToTable("KurdnezamContactChannels");

        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.Label).HasMaxLength(200);
        b.Property(x => x.Value).HasMaxLength(1000).IsRequired();

        b.HasOne(x => x.Section)
            .WithMany(s => s.Channels)
            .HasForeignKey(x => x.SectionId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => x.SectionId);

        // The validator rejects a bad kind first; this stops anything that reaches the database
        // another way, because the site switches on this value to pick tel:/mailto:/plain text.
        b.ToTable(t => t.HasCheckConstraint(
            "CK_KurdnezamContactChannels_Kind",
            $"[Kind] IN ({string.Join(", ", KurdnezamContactChannelKinds.All.Select(k => $"'{k}'"))})"));
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
