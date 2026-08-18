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
}
