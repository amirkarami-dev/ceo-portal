using System.Reflection;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Analytics;
using Mabhas19.Domain.Elections;
using Mabhas19.Domain.Rooms;
using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Kurdnezam;
using Mabhas19.Domain.MunSanandaj;
using Mabhas19.Domain.Vms;
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

    public DbSet<WelfareGuesthouse> WelfareGuesthouses => Set<WelfareGuesthouse>();

    public DbSet<GuesthouseRequest> GuesthouseRequests => Set<GuesthouseRequest>();

    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();

    public DbSet<Election> Elections => Set<Election>();

    public DbSet<ElectionCandidate> ElectionCandidates => Set<ElectionCandidate>();

    public DbSet<ElectionEligibleReshte> ElectionEligibleReshtes => Set<ElectionEligibleReshte>();

    // The two halves of the secret ballot. Never join these to each other, and never join either to
    // a user — see the remarks on ElectionVoteReceipt and ElectionBallot.
    public DbSet<ElectionVoteReceipt> ElectionVoteReceipts => Set<ElectionVoteReceipt>();

    public DbSet<ElectionBallot> ElectionBallots => Set<ElectionBallot>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<RoomInvite> RoomInvites => Set<RoomInvite>();

    public DbSet<RoomMessage> RoomMessages => Set<RoomMessage>();

    public DbSet<RoomBoard> RoomBoards => Set<RoomBoard>();

    public DbSet<RoomFile> RoomFiles => Set<RoomFile>();

    public DbSet<VmsCity> VmsCities => Set<VmsCity>();

    public DbSet<Camera> VmsCameras => Set<Camera>();

    public DbSet<KurdnezamSlide> KurdnezamSlides => Set<KurdnezamSlide>();

    public DbSet<KurdnezamQuickLink> KurdnezamQuickLinks => Set<KurdnezamQuickLink>();

    public DbSet<KurdnezamPerson> KurdnezamPeople => Set<KurdnezamPerson>();

    public DbSet<KurdnezamUnit> KurdnezamUnits => Set<KurdnezamUnit>();

    public DbSet<KurdnezamTabGroup> KurdnezamTabGroups => Set<KurdnezamTabGroup>();

    public DbSet<KurdnezamTabItem> KurdnezamTabItems => Set<KurdnezamTabItem>();

    public DbSet<KurdnezamForm> KurdnezamForms => Set<KurdnezamForm>();

    public DbSet<KurdnezamFormField> KurdnezamFormFields => Set<KurdnezamFormField>();

    public DbSet<KurdnezamFormAnswer> KurdnezamFormAnswers => Set<KurdnezamFormAnswer>();

    public DbSet<KurdnezamFormAttachment> KurdnezamFormAttachments => Set<KurdnezamFormAttachment>();

    public DbSet<KurdnezamFormSubmission> KurdnezamFormSubmissions => Set<KurdnezamFormSubmission>();

    public DbSet<KurdnezamContactMessage> KurdnezamContactMessages => Set<KurdnezamContactMessage>();

    public DbSet<KurdnezamOrgPage> KurdnezamOrgPages => Set<KurdnezamOrgPage>();

    public DbSet<KurdnezamContactSection> KurdnezamContactSections => Set<KurdnezamContactSection>();

    public DbSet<KurdnezamContactChannel> KurdnezamContactChannels => Set<KurdnezamContactChannel>();

    public DbSet<KurdnezamVisit> KurdnezamVisits => Set<KurdnezamVisit>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
