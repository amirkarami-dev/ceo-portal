using System.Security.Claims;

using Mabhas19.Application.Common.Interfaces;

namespace Mabhas19.Web.Services;

public class CurrentUser : IUser
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUser(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public string? Id => _httpContextAccessor.HttpContext?.User?.FindFirstValue("sub")
                         ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    public string? Name => _httpContextAccessor.HttpContext?.User?.FindFirstValue("name");
    public List<string>? Roles => _httpContextAccessor.HttpContext?.User?.FindAll("role").Select(x => x.Value).ToList();

}
