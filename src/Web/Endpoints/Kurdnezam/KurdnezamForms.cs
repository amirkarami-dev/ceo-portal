using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Application.Kurdnezam.Forms;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Forms for the kurdnezam landing site. Reads are public and so is sending one (that is the point
/// of it); managing forms, reading the inbox and downloading an attachment need the Administrator
/// role.
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

        // Public. Multipart, because the answers and the files arrive together: nothing is written
        // to storage until the whole submission has passed its checks, so there are never orphan
        // objects and the upload path cannot be driven on its own.
        groupBuilder.MapPost(SubmitKurdnezamForm, "{id:int}/submissions")
            .AllowAnonymous()
            .DisableAntiforgery()
            .RequireRateLimiting(RateLimitPolicies.PublicSubmission)
            // Kestrel refuses an over-sized body before it is buffered. The per-file and per-field
            // caps are checked later, in the handler, where they can name the offending file.
            .WithMetadata(new Microsoft.AspNetCore.Mvc.RequestSizeLimitAttribute(
                KurdnezamFormUploadLimits.MaxBytesPerSubmission));

        groupBuilder.MapPut(SetKurdnezamFormSubmissionHandled, "submissions/{submissionId:int}/handled").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamFormSubmission, "submissions/{submissionId:int}").RequireAdmin();

        // Attachments are never public: a member may attach a scan of their national id card.
        groupBuilder.MapGet(GetKurdnezamFormAttachment, "attachments/{attachmentId:int}").RequireAdmin();
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

    /// <summary>
    /// Multipart body: a text part named <c>answers</c> holding
    /// <c>[{"fieldId":1,"text":"…"}]</c>, plus file parts named <c>field_{fieldId}</c> — repeat the
    /// name to send several files for one field.
    /// </summary>
    public static async Task<Results<Created<int>, BadRequest<string>>> SubmitKurdnezamForm(
        ISender sender, HttpRequest request, int id, CancellationToken ct)
    {
        if (!request.HasFormContentType)
            return TypedResults.BadRequest("Send this as multipart/form-data.");

        var body = await request.ReadFormAsync(ct);

        List<KurdnezamFormAnswerInput> answers;
        try
        {
            var json = body["answers"].FirstOrDefault();
            answers = string.IsNullOrWhiteSpace(json)
                ? []
                : JsonSerializer.Deserialize<List<KurdnezamFormAnswerInput>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return TypedResults.BadRequest("The 'answers' part is not valid JSON.");
        }

        var files = new List<IKurdnezamFormUpload>();
        foreach (var part in body.Files)
        {
            // Anything not named field_{int} is ignored rather than guessed at.
            if (!part.Name.StartsWith("field_", StringComparison.Ordinal)) continue;
            if (!int.TryParse(part.Name.AsSpan("field_".Length), out var fieldId)) continue;

            files.Add(new FormFileUpload(fieldId, part));
        }

        var submissionId = await sender.Send(new SubmitKurdnezamFormCommand(id, answers, files), ct);
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

    /// <summary>Streams one attachment to an administrator. There is no public equivalent.</summary>
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetKurdnezamFormAttachment(
        ISender sender, IFileStorage storage, HttpContext http, int attachmentId, CancellationToken ct)
    {
        var file = await sender.Send(new GetKurdnezamFormAttachmentQuery(attachmentId), ct);

        Stream stream;
        try
        {
            stream = await storage.GetAsync(file.StoredKey, ct);
        }
        catch (Exception)
        {
            // Storage throws provider-specific "no such key" exceptions; a missing object is a 404.
            return TypedResults.NotFound();
        }

        // Never cached: this is somebody's personal document behind an admin session.
        http.Response.Headers.CacheControl = "no-store";

        // filename* (RFC 5987) so Persian names survive; plain `filename` would mangle them.
        http.Response.Headers.ContentDisposition =
            $"attachment; filename*=UTF-8''{Uri.EscapeDataString(file.FileName)}";

        return TypedResults.Stream(stream, file.ContentType);
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>Adapts one uploaded part to the Application layer's view of a file.</summary>
    private sealed class FormFileUpload(int fieldId, IFormFile file) : IKurdnezamFormUpload
    {
        public int FieldId => fieldId;

        // Browsers may send a full path on some platforms; keep only the name.
        public string FileName => Path.GetFileName(file.FileName);

        public string ContentType => file.ContentType ?? string.Empty;

        public long SizeBytes => file.Length;

        public Stream OpenRead() => file.OpenReadStream();
    }
}

/// <summary>Request body for PUT /api/kurdnezam/forms/submissions/{submissionId}/handled.</summary>
public sealed record KurdnezamFormSubmissionHandledRequest(bool IsHandled);
