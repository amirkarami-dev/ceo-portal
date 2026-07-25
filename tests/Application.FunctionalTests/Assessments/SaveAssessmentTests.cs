using Mabhas19.Application.Assessments.Commands.SaveAssessment;
using Mabhas19.Application.Assessments.Queries.GetAssessment;
using Mabhas19.Application.Projects.Commands.CreateProject;
using Mabhas19.Domain.Enums;
using ForbiddenAccessException = Mabhas19.Application.Common.Exceptions.ForbiddenAccessException;

namespace Mabhas19.Application.FunctionalTests.Assessments;

using static TestApp;

public class SaveAssessmentTests : TestBase
{
    [Test]
    public async Task ShouldSaveAndReadBackAssessment()
    {
        await RunAsDefaultUserAsync();
        var projectId = await SendAsync(new CreateProjectCommand { Title = "پروژه ارزیابی", City = "تهران" });

        await SendAsync(new SaveAssessmentCommand
        {
            ProjectId = projectId,
            InputJson = "{\"a\":1}",
            ResultJson = "{\"score\":42}",
            TotalScore = 42,
            MaxScore = 100
        });

        var assessment = await SendAsync(new GetAssessmentQuery(projectId));

        assessment.ShouldNotBeNull();
        assessment!.TotalScore.ShouldBe(42);
        assessment.MaxScore.ShouldBe(100);
        assessment.Status.ShouldBe(AssessmentStatus.Completed.ToString());
    }

    [Test]
    public async Task ShouldForbidSavingAssessmentForAnotherUsersProject()
    {
        await RunAsDefaultUserAsync();
        var projectId = await SendAsync(new CreateProjectCommand { Title = "پروژه دیگری", City = "تهران" });

        await RunAsUserAsync("intruder@local", "Intruder1234!", []);

        await Should.ThrowAsync<ForbiddenAccessException>(() => SendAsync(new SaveAssessmentCommand
        {
            ProjectId = projectId,
            TotalScore = 10,
            MaxScore = 100
        }));
    }
}
