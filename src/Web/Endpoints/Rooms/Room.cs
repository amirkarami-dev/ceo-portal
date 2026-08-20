using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Rooms;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Rooms;

/// <summary>
/// The attendee-facing endpoints. Auto-mapped to <c>/api/Room</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Nothing here ever returns a join link.</b> That is the whole reason this group is separate from
/// <see cref="RoomAdmin"/>: a link is the entire gate for a public presentation, so the DTOs that carry
/// one are reachable only from the Administrator group. One group with a role check inside it is one
/// forgotten branch away from handing the key out.
/// </para>
/// <para>
/// Two routes are deliberately anonymous. A public presentation is opened by people with no account —
/// that is the feature — so the link landing page and the link join must work with no token at all. They
/// are safe because the link itself is the credential: 32 random hex characters, revocable, and it only
/// ever leads to a room where the audience cannot publish.
/// </para>
/// <para>
/// Note what the join routes do not accept: no room id in the link path, no identity, no publish flag.
/// The link picks the meeting, the bearer token picks the person, and the meeting's own type decides
/// what they may do. The only thing a caller supplies is a name for themselves, and only when nobody is
/// signed in.
/// </para>
/// </remarks>
public class Room : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/Room";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetMyRooms, "MyRooms");
        groupBuilder.MapGet(GetRoomForAttendee, "{id:int}");
        groupBuilder.MapPost(JoinRoom, "{id:int}/join");

        // The link pages. Anonymous, and the request-level authorisation behaviour is what still runs
        // every gate — see JoinRoomByLinkCommand for why signing in changes the result rather than
        // being required.
        groupBuilder.MapGet(GetRoomLanding, "j/{joinToken}").AllowAnonymous();
        groupBuilder.MapPost(JoinRoomByLink, "j/{joinToken}").AllowAnonymous();

        // Chat. Anonymous for the same reason as the link routes — a guest in a public presentation
        // has no account — but never uncredentialled: they present the media token we signed for them
        // in `X-Room-Token`, and it is verified. See RoomChatAccess.
        groupBuilder.MapGet(GetRoomMessages, "{id:int}/messages").AllowAnonymous();
        groupBuilder.MapPost(SendRoomMessage, "{id:int}/messages").AllowAnonymous();

        // The whiteboard. Anonymous and credentialled exactly like chat — and the write is gated on
        // the same predicate as the microphone, inside the handler.
        groupBuilder.MapGet(GetRoomBoard, "{id:int}/board").AllowAnonymous();
        groupBuilder.MapPut(SaveRoomBoard, "{id:int}/board").AllowAnonymous();

        // The meeting's files. Anonymous for the same reason the board and the chat are: an audience
        // member on a public link has no account, and the handouts are for them. Every one of these
        // still runs the same access gate inside the handler.
        groupBuilder.MapGet(GetRoomFiles, "{id:int}/files").AllowAnonymous();
        groupBuilder.MapPost(UploadRoomFile, "{id:int}/files").AllowAnonymous().DisableAntiforgery();
        groupBuilder.MapGet(GetRoomFileContent, "files/{fileId:int}/content").AllowAnonymous();
        groupBuilder.MapDelete(DeleteRoomFile, "files/{fileId:int}").AllowAnonymous();
    }

    /// <summary>
    /// The guest's credential, in its own header.
    /// </summary>
    /// <remarks>
    /// Deliberately not <c>Authorization</c>. That header belongs to the IdP's tokens, and putting a
    /// second, differently-issued JWT in it would have the bearer middleware try to validate a media
    /// token against the IdP on every chat request — failing in a way that has nothing to do with why
    /// the request was refused.
    /// </remarks>
    private const string RoomTokenHeader = "X-Room-Token";

    /// <summary>Meetings this person may attend: invited to, or presenting.</summary>
    public static async Task<Ok<IReadOnlyList<MyRoomDto>>> GetMyRooms(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetMyRoomsQuery()));

    /// <summary>
    /// One meeting. A 404 for anything this person may not attend — including meetings that exist —
    /// so the route cannot be used to enumerate what the organisation is holding.
    /// </summary>
    public static async Task<Ok<RoomAttendeeDto>> GetRoomForAttendee(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetRoomAttendeeQuery(id)));

    /// <summary>Join by id — the invite-only path, where there is no link to hold.</summary>
    public static async Task<Ok<RoomJoinDto>> JoinRoom(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new JoinRoomCommand(id)));

    /// <summary>
    /// What the landing page shows: the meeting, who is presenting, and when the doors open.
    /// </summary>
    /// <remarks>
    /// Succeeds <b>before</b> the meeting opens — that is the point, because the page draws a countdown
    /// and enables its own button when the countdown ends. It carries no identifiers of any kind.
    /// </remarks>
    public static async Task<Ok<RoomLandingDto>> GetRoomLanding(ISender sender, string joinToken)
        => TypedResults.Ok(await sender.Send(new GetRoomLandingQuery(joinToken)));

    public sealed record JoinByLinkRequest(string? FullName);

    /// <summary>
    /// Join through a link. Public ⇒ a typed name is enough. Private ⇒ 401 until they sign in, then
    /// the same call succeeds with a member token.
    /// </summary>
    public static async Task<Ok<RoomJoinDto>> JoinRoomByLink(
        ISender sender, string joinToken, JoinByLinkRequest? request)
        => TypedResults.Ok(
            await sender.Send(new JoinRoomByLinkCommand(joinToken, request?.FullName)));

    /// <summary>
    /// The saved chat. Delivered live over the media server's data channel; this is the copy that
    /// survives a reload and lets somebody who joined late read what they missed.
    /// </summary>
    public static async Task<Ok<IReadOnlyList<RoomMessageDto>>> GetRoomMessages(
        ISender sender, HttpRequest http, int id, int? take)
        => TypedResults.Ok(
            await sender.Send(
                new GetRoomMessagesQuery(id, http.Headers[RoomTokenHeader].FirstOrDefault(), take ?? 100)));

    public sealed record SendMessageRequest(string Text);

    /// <summary>
    /// Note what the body does not carry: no sender, no display name, no guest flag. All three come
    /// from the credential, so a chat line cannot be attributed to somebody who did not write it.
    /// </summary>
    public static async Task<Ok<RoomMessageDto>> SendRoomMessage(
        ISender sender, HttpRequest http, int id, SendMessageRequest request)
        => TypedResults.Ok(
            await sender.Send(
                new SendRoomMessageCommand(
                    id, http.Headers[RoomTokenHeader].FirstOrDefault(), request.Text)));

    /// <summary>The saved whiteboard, or 204 when nobody has drawn yet.</summary>
    public static async Task<Results<Ok<RoomBoardDto>, NoContent>> GetRoomBoard(
        ISender sender, HttpRequest http, int id)
    {
        var board = await sender.Send(
            new GetRoomBoardQuery(id, http.Headers[RoomTokenHeader].FirstOrDefault()));

        return board is null ? TypedResults.NoContent() : TypedResults.Ok(board);
    }

    public sealed record SaveBoardRequest(string Scene);

    /// <summary>
    /// Replaces the board. Named <c>SaveRoomBoard</c>, not <c>SaveBoard</c>: two endpoint handlers
    /// sharing a method name once made the WHOLE API return 500, including routes nobody had touched.
    /// </summary>
    public static async Task<NoContent> SaveRoomBoard(
        ISender sender, HttpRequest http, int id, SaveBoardRequest request)
    {
        await sender.Send(
            new SaveRoomBoardCommand(id, http.Headers[RoomTokenHeader].FirstOrDefault(), request.Scene));

        return TypedResults.NoContent();
    }
    // ── the meeting's files ──────────────────────────────────────────────────
    //
    // These live in this group rather than a group of their own, because a meeting's files are a
    // sub-resource of the meeting exactly as its board and its chat are — same guest credential,
    // same access gate, same anonymous routes. A second group would have had to repeat all three.
    //
    // Every handler name carries the Room prefix. Two endpoint handlers anywhere in the application
    // sharing a method name make the WHOLE API return 500, including endpoints nobody touched.

    /// <summary>The files attached to a meeting. Anyone who may be in it may read them.</summary>
    public static async Task<Ok<IReadOnlyList<RoomFileDto>>> GetRoomFiles(
        ISender sender, HttpRequest http, int id)
        => TypedResults.Ok(await sender.Send(
            new GetRoomFilesQuery(id, http.Headers[RoomTokenHeader].FirstOrDefault())));

    /// <summary>Attaches one file. The gate is the same predicate that decides the microphone.</summary>
    public static async Task<Created<int>> UploadRoomFile(
        ISender sender, HttpRequest http, int id, IFormFile file, CancellationToken ct)
    {
        var fileId = await sender.Send(
            new UploadRoomFileCommand(id, http.Headers[RoomTokenHeader].FirstOrDefault(), new RoomUpload(file)),
            ct);

        return TypedResults.Created($"/api/Room/files/{fileId}/content", fileId);
    }

    /// <summary>
    /// Streams one file back.
    /// </summary>
    /// <remarks>
    /// The bytes go through the API rather than a storage URL, because the audience for a meeting is
    /// controlled and a presigned link would outlive that control. A browser will not put a token on
    /// a plain navigation either, so the client fetches this and saves the blob.
    /// </remarks>
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetRoomFileContent(
        ISender sender, IFileStorage storage, HttpContext http, int fileId, CancellationToken ct)
    {
        var file = await sender.Send(
            new GetRoomFileForDownloadQuery(fileId, http.Request.Headers[RoomTokenHeader].FirstOrDefault()),
            ct);

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

        // Not cached: this belongs to one meeting's audience, not to the browser cache.
        http.Response.Headers.CacheControl = "no-store";

        // filename* (RFC 5987) so Persian names survive; plain `filename` would mangle them.
        http.Response.Headers.ContentDisposition =
            $"attachment; filename*=UTF-8''{Uri.EscapeDataString(file.FileName)}";

        return TypedResults.Stream(stream, file.ContentType);
    }

    /// <summary>Removes one file, and its bytes.</summary>
    public static async Task<NoContent> DeleteRoomFile(
        ISender sender, HttpRequest http, int fileId, CancellationToken ct)
    {
        await sender.Send(
            new DeleteRoomFileCommand(fileId, http.Headers[RoomTokenHeader].FirstOrDefault()), ct);

        return TypedResults.NoContent();
    }

    /// <summary>Adapts one uploaded part to the Application layer's view of a file.</summary>
    private sealed class RoomUpload(IFormFile file) : IRoomFileUpload
    {
        // Browsers may send a full path on some platforms; keep only the name.
        public string FileName => Path.GetFileName(file.FileName);

        public string ContentType => file.ContentType;

        public long SizeBytes => file.Length;

        public Stream OpenRead() => file.OpenReadStream();
    }

}
