using System.Security.Claims;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints;

public class Users : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(Me, "me").RequireAuthorization();
    }

    [EndpointSummary("Current user profile + roles")]
    public static Results<Ok<CurrentUserDto>, UnauthorizedHttpResult> Me(HttpContext httpContext)
    {
        var user = httpContext.User;
        var id = user.FindFirstValue("sub") ?? user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(id)) return TypedResults.Unauthorized();

        var roles = user.FindAll("role").Select(c => c.Value).ToArray();
        var email = user.FindFirstValue("email");
        var phoneNumber = user.FindFirstValue("phone_number");
        var isAdmin = user.IsInRole(Roles.Administrator);

        return TypedResults.Ok(new CurrentUserDto(id, email, phoneNumber, roles, isAdmin));
    }
}

public record CurrentUserDto(string Id, string? Email, string? PhoneNumber, string[] Roles, bool IsAdmin);
