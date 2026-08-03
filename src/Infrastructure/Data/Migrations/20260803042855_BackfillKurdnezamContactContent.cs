using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <summary>
    /// Brings an installation that already has content up to what <c>KurdnezamSeeder</c> now produces
    /// for a fresh one: the five organs become cards on <c>/p/arkan</c>, the contact page's intro
    /// paragraph gets a row, and the head-office contact block is assembled from the details already
    /// in settings.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Why this is a migration of its own.</b> It began inside
    /// <c>AddKurdnezamContactSections</c> and failed there with <i>Invalid column name 'ParentSlug'</i>.
    /// SQL Server compiles a whole batch before executing any of it, so an <c>UPDATE</c> naming a
    /// column that an earlier statement in the same batch adds cannot resolve. A second migration is
    /// a second batch, by which time the columns exist. (<c>EXEC sp_executesql</c> would also work,
    /// but it would bury four hundred characters of Persian text in doubled quotes.)
    /// </para>
    /// <para>
    /// The model is unchanged, so <c>ef migrations add</c> produced an empty <c>Up()</c> and a
    /// snapshot identical to the previous migration's. That is expected here — it is <b>not</b> the
    /// stale-startup-bin trap recorded in GOTCHAS.
    /// </para>
    /// </remarks>
    public partial class BackfillKurdnezamContactContent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The guard on KurdnezamOrgPages being non-empty is load-bearing. On an EMPTY database
            // migrations run first and the seeder second, so without it this would insert `tamas`
            // and the seeder would then insert it again — straight into the unique index on Slug.
            //   empty database    → this does nothing, the seeder does everything
            //   existing database → this does everything, the seeder is already a no-op
            // Every statement is independently idempotent too, so a re-run cannot double anything.
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM [KurdnezamOrgPages])
BEGIN
    -- The five organs: each becomes a card on /p/arkan AND an entry in its nav dropdown, because
    -- both now read the same rows. SortOrder follows the order the arkan page's own Intro lists
    -- them in, which is the order the law gives — مجمع عمومی first, بازرسان last.
    UPDATE [KurdnezamOrgPages] SET [ParentSlug] = 'arkan', [Icon] = 'vote',
        [Summary] = N'عالی‌ترین رکن سازمان، متشکل از کلیه اعضای دارای پروانه اشتغال.',
        [SortOrder] = 1 WHERE [Slug] = 'majmaeomumi';

    UPDATE [KurdnezamOrgPages] SET [ParentSlug] = 'arkan', [Icon] = 'users-round',
        [Summary] = N'اداره امور سازمان و اجرای مصوبات مجمع عمومی.',
        [SortOrder] = 2 WHERE [Slug] = 'modir';

    UPDATE [KurdnezamOrgPages] SET [ParentSlug] = 'arkan', [Icon] = 'landmark',
        [Summary] = N'مدیریت اجرایی و راهبری روزانه سازمان.',
        [SortOrder] = 3 WHERE [Slug] = 'hayatraise';

    UPDATE [KurdnezamOrgPages] SET [ParentSlug] = 'arkan', [Icon] = 'gavel',
        [Summary] = N'مرجع رسیدگی به تخلفات حرفه‌ای اعضای سازمان.',
        [SortOrder] = 4 WHERE [Slug] = 'shorayeentezami';

    UPDATE [KurdnezamOrgPages] SET [ParentSlug] = 'arkan', [Icon] = 'scroll-text',
        [Summary] = N'نظارت بر عملکرد مالی و اجرایی سازمان.',
        [SortOrder] = 5 WHERE [Slug] = 'bazrsin';

    UPDATE [KurdnezamOrgPages] SET [Icon] = 'landmark'
        WHERE [Slug] = 'arkan' AND [Icon] IS NULL;

    -- The contact page's intro paragraph, which until now was a string literal in the site.
    IF NOT EXISTS (SELECT 1 FROM [KurdnezamOrgPages] WHERE [Slug] = 'tamas')
        INSERT INTO [KurdnezamOrgPages]
            ([Slug], [Title], [Group], [Intro], [ParentSlug], [Icon], [Summary], [SortOrder], [Created], [LastModified])
        VALUES
            ('tamas', N'تماس با ما', NULL,
             N'برای طرح پرسش، پیشنهاد یا شکایت می‌توانید از راه‌های زیر با سازمان در ارتباط باشید؛ کارشناسان ما در ساعات اداری پاسخگوی شما هستند.',
             NULL, 'headset', N'', 2, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());

    -- Caption on the map panel, previously also a literal.
    UPDATE [KurdnezamSettings]
        SET [MapLabel] = N'سنندج، میدان کوهنورد — جنب بانک مسکن'
        WHERE [MapLabel] = N'';

    -- The head-office block, assembled from whatever settings currently holds rather than from
    -- values written in here — so this cannot ship a phone number that has since changed.
    IF NOT EXISTS (SELECT 1 FROM [KurdnezamContactSections])
    BEGIN
        INSERT INTO [KurdnezamContactSections]
            ([Title], [Description], [Icon], [SortOrder], [IsActive], [Created], [LastModified])
        VALUES
            (N'دفتر مرکزی', N'پاسخگویی در ساعات اداری', 'building', 1, 1,
             SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET());

        DECLARE @sectionId INT = CONVERT(INT, SCOPE_IDENTITY());

        INSERT INTO [KurdnezamContactChannels]
            ([SectionId], [Kind], [Label], [Value], [SortOrder], [Created], [LastModified])
        SELECT @sectionId, 'address', NULL, s.[Address], 1, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
        FROM [KurdnezamSettings] s
        WHERE s.[Id] = 1 AND LEN(s.[Address]) > 0;

        -- Phones are a JSON array in settings. OPENJSON needs compatibility level >= 130; this
        -- database is 160 (SQL Server 2022), checked before relying on it.
        INSERT INTO [KurdnezamContactChannels]
            ([SectionId], [Kind], [Label], [Value], [SortOrder], [Created], [LastModified])
        SELECT @sectionId, 'phone', NULL, j.[value],
               1 + ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
               SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
        FROM [KurdnezamSettings] s
        CROSS APPLY OPENJSON(s.[PhonesJson]) j
        WHERE s.[Id] = 1 AND LEN(j.[value]) > 0;

        -- 100, not 6: leaves room for the admin to add rows above it without renumbering.
        INSERT INTO [KurdnezamContactChannels]
            ([SectionId], [Kind], [Label], [Value], [SortOrder], [Created], [LastModified])
        SELECT @sectionId, 'postal', NULL, s.[PostalCode], 100, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
        FROM [KurdnezamSettings] s
        WHERE s.[Id] = 1 AND LEN(s.[PostalCode]) > 0;
    END
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Everything else this migration wrote lives in columns and tables that the previous
            // migration's Down() drops; the tamas page is the only row that would survive it.
            migrationBuilder.Sql("DELETE FROM [KurdnezamOrgPages] WHERE [Slug] = 'tamas';");
        }
    }
}
