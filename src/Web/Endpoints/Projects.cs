using Mabhas19.Application.Assessments;
using Mabhas19.Application.Assessments.Commands.GenerateReport;
using Mabhas19.Application.Assessments.Commands.SaveAssessment;
using Mabhas19.Application.Assessments.Queries.GetAssessment;
using Mabhas19.Application.Projects;
using Mabhas19.Application.Projects.Commands.CreateProject;
using Mabhas19.Application.Projects.Commands.DeleteProject;
using Mabhas19.Application.Projects.Commands.ImportProject;
using Mabhas19.Application.Projects.Commands.UpdateProject;
using Mabhas19.Application.Projects.Queries.GetProject;
using Mabhas19.Application.Projects.Queries.GetProjects;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints;

public class Projects : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetProjects);
        groupBuilder.MapGet(GetProject, "{id}");
        groupBuilder.MapPost(CreateProject);
        groupBuilder.MapPost(ImportProject, "import");
        groupBuilder.MapPut(UpdateProject, "{id}");
        groupBuilder.MapDelete(DeleteProject, "{id}");

        groupBuilder.MapGet(GetAssessment, "{id}/assessment");
        groupBuilder.MapPut(SaveAssessment, "{id}/assessment");
        groupBuilder.MapPost(GenerateReport, "{id}/report");
    }

    public static async Task<Ok<IReadOnlyList<ProjectDto>>> GetProjects(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetProjectsQuery()));

    public static async Task<Ok<ProjectDto>> GetProject(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetProjectByIdQuery(id)));

    public static async Task<Created<int>> CreateProject(ISender sender, CreateProjectCommand command)
    {
        var newId = await sender.Send(command);
        return TypedResults.Created($"/api/Projects/{newId}", newId);
    }

    public static async Task<Created<int>> ImportProject(ISender sender, ImportProjectCommand command)
    {
        var newId = await sender.Send(command);
        return TypedResults.Created($"/api/Projects/{newId}", newId);
    }

    public static async Task<Results<NoContent, BadRequest>> UpdateProject(ISender sender, int id, UpdateProjectCommand command)
    {
        if (id != command.Id) return TypedResults.BadRequest();
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteProject(ISender sender, int id)
    {
        await sender.Send(new DeleteProjectCommand(id));
        return TypedResults.NoContent();
    }

    public static async Task<Results<Ok<AssessmentDto>, NotFound>> GetAssessment(ISender sender, int id)
    {
        var result = await sender.Send(new GetAssessmentQuery(id));
        return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
    }

    public static async Task<NoContent> SaveAssessment(ISender sender, int id, SaveAssessmentRequest body)
    {
        await sender.Send(new SaveAssessmentCommand
        {
            ProjectId = id,
            InputJson = body.InputJson,
            ResultJson = body.ResultJson,
            TotalScore = body.TotalScore,
            MaxScore = body.MaxScore
        });
        return TypedResults.NoContent();
    }

    public static async Task<Ok<GenerateReportResult>> GenerateReport(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GenerateReportCommand(id)));
}

public record SaveAssessmentRequest
{
    public string InputJson { get; init; } = "{}";
    public string ResultJson { get; init; } = "{}";
    public int TotalScore { get; init; }
    public int MaxScore { get; init; }
}
