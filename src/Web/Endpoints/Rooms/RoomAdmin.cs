using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Rooms;

/// <summary>
/// Admin management of meetings. Auto-mapped to <c>/api/RoomAdmin</c>.
/// </summary>
/// <remarks>
/// <para>
/// Administrator-only, at the group level. This is the only place a join link is ever returned, and
/// that is deliberate: the link is the whole gate for a public presentation, so it must not appear in
/// any response an attendee can reach.
/// </para>
/// <para>
/// Joining is NOT here. It gets its own group with its own rules, because an attendee arrives with a
/// link rather than a login.
/// </para>
/// <para>
/// Every handler name is <c>Room</c>-flavoured, like <c>GetKurdnezamNews</c> and
/// <c>CreateWalfareService</c> elsewhere. That is not style: the mapper turns each method name into a
/// <b>globally unique</b> endpoint name, and a collision with any other group makes every route in the
/// API answer 500. See GOTCHAS.
/// </para>
/// </remarks>
public class RoomAdmin : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/RoomAdmin";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator, Roles.SuperUser));

        groupBuilder.MapGet(GetRoomsAdmin, string.Empty);
        groupBuilder.MapGet(GetRoomAdmin, "{id:int}");
        groupBuilder.MapPost(CreateRoom, string.Empty);
        groupBuilder.MapPut(UpdateRoom, "{id:int}");
        groupBuilder.MapPost(RegenerateRoomLink, "{id:int}/link");
        groupBuilder.MapPost(SetRoomActive, "{id:int}/active");
        groupBuilder.MapDelete(DeleteRoom, "{id:int}");
        groupBuilder.MapPost(InviteToRoom, "{id:int}/invites");
        groupBuilder.MapDelete(RemoveRoomInvite, "{id:int}/invites/{userId}");
        groupBuilder.MapGet(LookupRoomPerson, "people/{nationalCode}");
    }

    public static async Task<Ok<IReadOnlyList<RoomListItemDto>>> GetRoomsAdmin(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetRoomsQuery()));

    public static async Task<Ok<RoomDetailDto>> GetRoomAdmin(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetRoomQuery(id)));

    public static async Task<Created<int>> CreateRoom(ISender sender, RoomInput input)
    {
        var id = await sender.Send(new CreateRoomCommand(input));
        return TypedResults.Created($"/api/RoomAdmin/{id}", id);
    }

    public static async Task<NoContent> UpdateRoom(ISender sender, int id, RoomInput input)
    {
        await sender.Send(new UpdateRoomCommand(id, input));
        return TypedResults.NoContent();
    }

    /// <summary>
    /// Issues a new link and kills every copy of the old one.
    /// </summary>
    /// <remarks>
    /// Returns the full URL, not the raw token, so the admin panel has nothing to assemble — the one
    /// place the base address is decided is the server.
    /// </remarks>
    public static async Task<Ok<string>> RegenerateRoomLink(ISender sender, int id)
    {
        await sender.Send(new RegenerateRoomLinkCommand(id));

        var room = await sender.Send(new GetRoomQuery(id));
        return TypedResults.Ok(room.JoinUrl ?? string.Empty);
    }

    public sealed record SetActiveRequest(bool IsActive);

    public static async Task<NoContent> SetRoomActive(ISender sender, int id, SetActiveRequest request)
    {
        await sender.Send(new SetRoomActiveCommand(id, request.IsActive));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteRoom(ISender sender, int id)
    {
        await sender.Send(new DeleteRoomCommand(id));
        return TypedResults.NoContent();
    }

    public sealed record InviteRequest(string NationalCode);

    public static async Task<NoContent> InviteToRoom(ISender sender, int id, InviteRequest request)
    {
        await sender.Send(new InviteToRoomCommand(id, request.NationalCode));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> RemoveRoomInvite(ISender sender, int id, string userId)
    {
        await sender.Send(new RemoveRoomInviteCommand(id, userId));
        return TypedResults.NoContent();
    }

    /// <summary>
    /// کد ملی → the name on file, so the presenter and invite boxes can confirm a person before saving.
    /// </summary>
    /// <remarks>
    /// One direction only. A route that searched by name would be a downloadable membership list.
    /// </remarks>
    public static async Task<Ok<RoomPersonDto>> LookupRoomPerson(ISender sender, string nationalCode)
        => TypedResults.Ok(await sender.Send(new LookupRoomPersonQuery(nationalCode)));
}
