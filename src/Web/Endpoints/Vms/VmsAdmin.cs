using Mabhas19.Application.Vms;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Vms;

/// <summary>
/// Admin management of cameras. Auto-mapped to <c>/api/VmsAdmin</c>.
/// </summary>
/// <remarks>
/// <para>
/// Administrator-only at the group level, and for this service that is the whole authorisation model:
/// the design settled that only administrators may watch, so a city is classification and filtering
/// rather than a permission.
/// </para>
/// <para>
/// Nothing here returns a camera password, because nothing stores one. A camera row names a
/// credential (<c>CredentialKey</c>) that exists only in a file on the media VPS.
/// </para>
/// <para>
/// Every handler name is <c>Camera</c>- or <c>Vms</c>-flavoured, like <c>GetRoomAdmin</c> and
/// <c>CreateWalfareService</c> elsewhere. That is not style: the mapper turns each method name into a
/// <b>globally unique</b> endpoint name, and a collision with any other group makes every route in the
/// API answer 500. See GOTCHAS.
/// </para>
/// </remarks>
public class VmsAdmin : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/VmsAdmin";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetVmsCities, "cities");
        groupBuilder.MapGet(GetCamerasAdmin, string.Empty);
        groupBuilder.MapGet(GetCameraAdmin, "{id:int}");
        groupBuilder.MapPost(CreateCamera, string.Empty);
        groupBuilder.MapPut(UpdateCamera, "{id:int}");
        groupBuilder.MapPost(SetCameraActive, "{id:int}/active");
        groupBuilder.MapDelete(DeleteCamera, "{id:int}");
    }

    /// <summary>The cities, each with how many live cameras it holds.</summary>
    public static async Task<Ok<IReadOnlyList<VmsCityDto>>> GetVmsCities(
        ISender sender, bool includeInactive = false)
        => TypedResults.Ok(await sender.Send(new GetVmsCitiesQuery(includeInactive)));

    /// <param name="cityCode">Optional. Omit for every camera.</param>
    public static async Task<Ok<IReadOnlyList<CameraListItemDto>>> GetCamerasAdmin(
        ISender sender, string? cityCode = null)
        => TypedResults.Ok(await sender.Send(new GetCamerasQuery(cityCode)));

    public static async Task<Ok<CameraDetailDto>> GetCameraAdmin(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetCameraQuery(id)));

    public static async Task<Created<int>> CreateCamera(ISender sender, CameraInput input)
    {
        var id = await sender.Send(new CreateCameraCommand(input));
        return TypedResults.Created($"/api/VmsAdmin/{id}", id);
    }

    public static async Task<NoContent> UpdateCamera(ISender sender, int id, CameraInput input)
    {
        await sender.Send(new UpdateCameraCommand(id, input));
        return TypedResults.NoContent();
    }

    public sealed record SetCameraActiveRequest(bool IsActive);

    public static async Task<NoContent> SetCameraActive(
        ISender sender, int id, SetCameraActiveRequest request)
    {
        await sender.Send(new SetCameraActiveCommand(id, request.IsActive));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteCamera(ISender sender, int id)
    {
        await sender.Send(new DeleteCameraCommand(id));
        return TypedResults.NoContent();
    }
}
