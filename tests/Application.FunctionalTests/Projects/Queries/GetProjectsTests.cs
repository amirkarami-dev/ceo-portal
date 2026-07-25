using Mabhas19.Application.Projects.Commands.CreateProject;
using Mabhas19.Application.Projects.Queries.GetProjects;

namespace Mabhas19.Application.FunctionalTests.Projects.Queries;

using static TestApp;

public class GetProjectsTests : TestBase
{
    [Test]
    public async Task ShouldReturnOnlyCallersProjects()
    {
        await RunAsDefaultUserAsync();
        await SendAsync(new CreateProjectCommand { Title = "مال کاربر اول", City = "تهران" });

        await RunAsUserAsync("second@local", "Second1234!", []);
        await SendAsync(new CreateProjectCommand { Title = "مال کاربر دوم", City = "مشهد" });

        var projects = await SendAsync(new GetProjectsQuery());

        projects.Count.ShouldBe(1);
        projects[0].Title.ShouldBe("مال کاربر دوم");
    }

    [Test]
    public async Task ShouldReturnEmptyWhenCallerHasNoProjects()
    {
        await RunAsDefaultUserAsync();

        var projects = await SendAsync(new GetProjectsQuery());

        projects.ShouldBeEmpty();
    }
}
