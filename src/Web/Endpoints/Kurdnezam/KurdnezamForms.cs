using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Application.Kurdnezam.Forms;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Registration forms for the kurdnezam landing site. Reads are public and so is submitting a form
/// (that is the point of it); managing forms and reading the submission inbox require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamForms : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/forms";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        // "submissions" is matched ahead of "{id:int}" by the int constraint, not by order.
        groupBuilder.MapGet(GetKurdnezamFormSubmissions, "submissions").RequireAdmin();

        groupBuilder.MapGet(GetKurdnezamForms, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamFormById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamForm, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamForm, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamForm, "{id:int}").RequireAdmin();

        // Public registration — a member submits the form without an account.
        groupBuilder.MapPost(SubmitKurdnezamForm, "{id:int}/submissions").AllowAnonymous();

        groupBuilder.MapPut(SetKurdnezamFormSubmissionHandled, "submissions/{submissionId:int}/handled").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamFormSubmission, "submissions/{submissionId:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamFormDto>>> GetKurdnezamForms(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamFormsQuery()));

    public static async Task<Ok<KurdnezamFormDto>> GetKurdnezamFormById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamFormByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamForm(ISender sender, KurdnezamFormInput body)
    {
        var id = await sender.Send(new CreateKurdnezamFormCommand(body));
        return TypedResults.Created($"/api/kurdnezam/forms/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamForm(ISender sender, int id, KurdnezamFormInput body)
    {
        await sender.Send(new UpdateKurdnezamFormCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamForm(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamFormCommand(id));
        return TypedResults.NoContent();
    }

    public static async Task<Created<int>> SubmitKurdnezamForm(ISender sender, int id, KurdnezamFormSubmissionInput body)
    {
        var submissionId = await sender.Send(new SubmitKurdnezamFormCommand(id, body));
        return TypedResults.Created($"/api/kurdnezam/forms/{id}/submissions/{submissionId}", submissionId);
    }

    public static async Task<Ok<KurdnezamPagedResult<KurdnezamFormSubmissionDto>>> GetKurdnezamFormSubmissions(
        ISender sender,
        int? formId = null,
        bool? handled = null,
        int page = 1,
        int pageSize = 20)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamFormSubmissionsQuery(formId, handled, page, pageSize)));

    public static async Task<NoContent> SetKurdnezamFormSubmissionHandled(
        ISender sender,
        int submissionId,
        KurdnezamFormSubmissionHandledRequest body)
    {
        await sender.Send(new SetKurdnezamFormSubmissionHandledCommand(submissionId, body.IsHandled));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamFormSubmission(ISender sender, int submissionId)
    {
        await sender.Send(new DeleteKurdnezamFormSubmissionCommand(submissionId));
        return TypedResults.NoContent();
    }
}

/// <summary>Request body for PUT /api/kurdnezam/forms/submissions/{submissionId}/handled.</summary>
public sealed record KurdnezamFormSubmissionHandledRequest(bool IsHandled);
