using System.Reflection;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Analytics;
using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Kurdnezam;
using Mabhas19.Domain.MunSanandaj;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Infrastructure.Data;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Project> Projects => Set<Project>();

    public DbSet<Assessment> Assessments => Set<Assessment>();

    public DbSet<AssessmentReport> AssessmentReports => Set<AssessmentReport>();

    public DbSet<Subscription> Subscriptions => Set<Subscription>();

    // Analytics aggregates
    public DbSet<AnalyticsReport> AnalyticsReports => Set<AnalyticsReport>();

    public DbSet<Dashboard> AnalyticsDashboards => Set<Dashboard>();

    public DbSet<AiProvider> AnalyticsAiProviders => Set<AiProvider>();

    public DbSet<Tenant> AnalyticsTenants => Set<Tenant>();

    public DbSet<AuditEvent> AnalyticsAuditEvents => Set<AuditEvent>();

    // MunSanandaj integration
    public DbSet<MunSyncRun> MunSyncRuns => Set<MunSyncRun>();

    public DbSet<MunReportLog> MunReportLogs => Set<MunReportLog>();

    // Kurdnezam landing site (CMS content + public submissions)
    public DbSet<KurdnezamSettings> KurdnezamSettings => Set<KurdnezamSettings>();

    public DbSet<KurdnezamFooterLink> KurdnezamFooterLinks => Set<KurdnezamFooterLink>();

    public DbSet<KurdnezamCategory> KurdnezamCategories => Set<KurdnezamCategory>();

    public DbSet<KurdnezamNews> KurdnezamNews => Set<KurdnezamNews>();

    public DbSet<KurdnezamNewsAttachment> KurdnezamNewsAttachments => Set<KurdnezamNewsAttachment>();

    public DbSet<WelfareService> WelfareServices => Set<WelfareService>();

    public DbSet<WelfarePool> WelfarePools => Set<WelfarePool>();

    public DbSet<WelfarePoolReservation> WelfarePoolReservations => Set<WelfarePoolReservation>();

    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();

    public DbSet<KurdnezamSlide> KurdnezamSlides => Set<KurdnezamSlide>();

    public DbSet<KurdnezamQuickLink> KurdnezamQuickLinks => Set<KurdnezamQuickLink>();

    public DbSet<KurdnezamPerson> KurdnezamPeople => Set<KurdnezamPerson>();

    public DbSet<KurdnezamUnit> KurdnezamUnits => Set<KurdnezamUnit>();

    public DbSet<KurdnezamTabGroup> KurdnezamTabGroups => Set<KurdnezamTabGroup>();

    public DbSet<KurdnezamTabItem> KurdnezamTabItems => Set<KurdnezamTabItem>();

    public DbSet<KurdnezamForm> KurdnezamForms => Set<KurdnezamForm>();

    public DbSet<KurdnezamFormSubmission> KurdnezamFormSubmissions => Set<KurdnezamFormSubmission>();

    public DbSet<KurdnezamContactMessage> KurdnezamContactMessages => Set<KurdnezamContactMessage>();

    public DbSet<KurdnezamOrgPage> KurdnezamOrgPages => Set<KurdnezamOrgPage>();

    public DbSet<KurdnezamVisit> KurdnezamVisits => Set<KurdnezamVisit>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
