using Mabhas19.Domain.Analytics;
using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Kurdnezam;
using Mabhas19.Domain.MunSanandaj;
using Mabhas19.Domain.Walfare;

namespace Mabhas19.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Project> Projects { get; }

    DbSet<Assessment> Assessments { get; }

    DbSet<AssessmentReport> AssessmentReports { get; }

    DbSet<Subscription> Subscriptions { get; }

    // Analytics aggregates
    DbSet<AnalyticsReport> AnalyticsReports { get; }

    DbSet<Dashboard> AnalyticsDashboards { get; }

    DbSet<AiProvider> AnalyticsAiProviders { get; }

    DbSet<Tenant> AnalyticsTenants { get; }

    DbSet<AuditEvent> AnalyticsAuditEvents { get; }

    // MunSanandaj integration
    DbSet<MunSyncRun> MunSyncRuns { get; }

    DbSet<MunReportLog> MunReportLogs { get; }

    // Kurdnezam landing site (CMS content + public submissions)
    DbSet<KurdnezamSettings> KurdnezamSettings { get; }

    DbSet<KurdnezamFooterLink> KurdnezamFooterLinks { get; }

    DbSet<KurdnezamCategory> KurdnezamCategories { get; }

    DbSet<KurdnezamNews> KurdnezamNews { get; }

    DbSet<KurdnezamNewsAttachment> KurdnezamNewsAttachments { get; }

    DbSet<WelfareService> WelfareServices { get; }

    DbSet<WelfarePool> WelfarePools { get; }

    DbSet<WelfarePoolReservation> WelfarePoolReservations { get; }

    DbSet<PaymentTransaction> PaymentTransactions { get; }

    DbSet<KurdnezamSlide> KurdnezamSlides { get; }

    DbSet<KurdnezamQuickLink> KurdnezamQuickLinks { get; }

    DbSet<KurdnezamPerson> KurdnezamPeople { get; }

    DbSet<KurdnezamUnit> KurdnezamUnits { get; }

    DbSet<KurdnezamTabGroup> KurdnezamTabGroups { get; }

    DbSet<KurdnezamTabItem> KurdnezamTabItems { get; }

    DbSet<KurdnezamForm> KurdnezamForms { get; }

    DbSet<KurdnezamFormSubmission> KurdnezamFormSubmissions { get; }

    DbSet<KurdnezamContactMessage> KurdnezamContactMessages { get; }

    DbSet<KurdnezamOrgPage> KurdnezamOrgPages { get; }

    DbSet<KurdnezamVisit> KurdnezamVisits { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
