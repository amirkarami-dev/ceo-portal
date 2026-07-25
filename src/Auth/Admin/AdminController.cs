using Mabhas19.Auth.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Mabhas19.Auth.Admin;

/// <summary>
/// Central user-management API, consumed by the admin-web SPA. Every action requires the
/// <c>Administrator</c> role on a bearer token issued by this IdP. The authentication scheme is
/// pinned to OpenIddict validation because <c>AddIdentity</c> makes the application cookie the
/// default scheme — without this a bearer call would 302 to /Account/Login instead of returning 401.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Administrator",
    AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class AdminController(
    UserManager<AuthUser> userManager,
    RoleManager<IdentityRole> roleManager,
    IServiceAccessStore serviceAccess,
    IOpenIddictAuthorizationManager authorizationManager) : ControllerBase
{
    private const string Administrator = "Administrator";

    // ── Users ──────────────────────────────────────────────────────────────────

    [HttpGet("users")]
    public async Task<ActionResult<PagedUsers>> GetUsers(
        string? search = null, int page = 1, int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize is < 1 or > 200) pageSize = 20;

        var query = userManager.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(u =>
                (u.UserName != null && u.UserName.Contains(term)) ||
                (u.Email != null && u.Email.Contains(term)) ||
                (u.PhoneNumber != null && u.PhoneNumber.Contains(term)));
        }

        var total = await query.CountAsync(HttpContext.RequestAborted);
        var users = await query
            .OrderBy(u => u.UserName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(HttpContext.RequestAborted);

        var items = new List<UserDto>(users.Count);
        foreach (var u in users)
            items.Add(await ToDtoAsync(u));

        return Ok(new PagedUsers(items, total, page, pageSize));
    }

    [HttpGet("users/{id}")]
    public async Task<ActionResult<UserDto>> GetUser(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();
        return Ok(await ToDtoAsync(user));
    }

    [HttpPost("users")]
    public async Task<ActionResult<CreatedUser>> CreateUser([FromBody] CreateUserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.UserName))
            return Fail("نام کاربری الزامی است.");

        var roles = Distinct(request.Roles);
        if (await FirstInvalidRoleAsync(roles) is { } badRole)
            return Fail($"نقش نامعتبر: {badRole}");

        if (request.Services?.FirstOrDefault(s => !ServiceKeys.IsValidKey(s)) is { } badService)
            return Fail($"سرویس نامعتبر: {badService}");

        var user = new AuthUser
        {
            UserName       = request.UserName.Trim(),
            Email          = Trimmed(request.Email),
            PhoneNumber    = Trimmed(request.PhoneNumber),
            EmailConfirmed = true
        };

        var created = string.IsNullOrWhiteSpace(request.Password)
            ? await userManager.CreateAsync(user)
            : await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded) return IdentityError(created);

        if (roles.Count > 0)
        {
            var addRoles = await userManager.AddToRolesAsync(user, roles);
            if (!addRoles.Succeeded) return IdentityError(addRoles);
        }

        await serviceAccess.ReplaceAsync(user.Id, request.Services ?? [], CallerName,
            HttpContext.RequestAborted);

        return Ok(new CreatedUser(user.Id));
    }

    [HttpPut("users/{id}")]
    public async Task<IActionResult> UpdateUser(string id, [FromBody] UpdateUserRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        if (request.UserName is not null)
        {
            var result = await userManager.SetUserNameAsync(user, request.UserName.Trim());
            if (!result.Succeeded) return IdentityError(result);
        }
        if (request.Email is not null)
        {
            var result = await userManager.SetEmailAsync(user, Trimmed(request.Email));
            if (!result.Succeeded) return IdentityError(result);
        }
        if (request.PhoneNumber is not null)
        {
            var result = await userManager.SetPhoneNumberAsync(user, Trimmed(request.PhoneNumber));
            if (!result.Succeeded) return IdentityError(result);
        }
        if (request.Locked is bool locked)
        {
            // A real disable/enable: locking sets LockoutEnd far in the future; unlocking clears it.
            // (SetLockoutEnabledAsync only flips the eligibility flag, which does not disable anyone.)
            if (locked && IsSelf(user))
                return Fail("نمی‌توانید حساب خودتان را قفل کنید.");

            await userManager.SetLockoutEnabledAsync(user, true);
            var result = await userManager.SetLockoutEndDateAsync(
                user, locked ? DateTimeOffset.MaxValue : null);
            if (!result.Succeeded) return IdentityError(result);
        }

        return NoContent();
    }

    [HttpPut("users/{id}/roles")]
    public async Task<IActionResult> SetRoles(string id, [FromBody] RolesRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        var desired = Distinct(request.Roles);
        if (await FirstInvalidRoleAsync(desired) is { } badRole)
            return Fail($"نقش نامعتبر: {badRole}");

        var current = await userManager.GetRolesAsync(user);
        var hasAdmin = current.Any(r => string.Equals(r, Administrator, StringComparison.OrdinalIgnoreCase));
        var wantsAdmin = desired.Any(r => string.Equals(r, Administrator, StringComparison.OrdinalIgnoreCase));
        var removingAdmin = hasAdmin && !wantsAdmin;

        if (removingAdmin && IsSelf(user))
            return Fail("نمی‌توانید نقش مدیر را از حساب خودتان حذف کنید.");
        if (removingAdmin && await CountAdministratorsAsync() <= 1)
            return Fail("حذف آخرین مدیر مجاز نیست.");

        var toRemove = current.Except(desired, StringComparer.OrdinalIgnoreCase).ToList();
        var toAdd    = desired.Except(current, StringComparer.OrdinalIgnoreCase).ToList();

        if (toRemove.Count > 0)
        {
            var result = await userManager.RemoveFromRolesAsync(user, toRemove);
            if (!result.Succeeded) return IdentityError(result);
        }
        if (toAdd.Count > 0)
        {
            var result = await userManager.AddToRolesAsync(user, toAdd);
            if (!result.Succeeded) return IdentityError(result);
        }

        return NoContent();
    }

    [HttpPut("users/{id}/services")]
    public async Task<IActionResult> SetServices(string id, [FromBody] ServicesRequest request)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        if (request.Services?.FirstOrDefault(s => !ServiceKeys.IsValidKey(s)) is { } badService)
            return Fail($"سرویس نامعتبر: {badService}");

        await serviceAccess.ReplaceAsync(user.Id, request.Services ?? [], CallerName,
            HttpContext.RequestAborted);
        return NoContent();
    }

    [HttpPost("users/{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id, [FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword))
            return Fail("رمز عبور جدید الزامی است.");

        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        // Reset-token flow: no plaintext is ever stored — the token is generated and immediately consumed.
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded) return IdentityError(result);

        return NoContent();
    }

    [HttpDelete("users/{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        if (IsSelf(user))
            return Fail("نمی‌توانید حساب خودتان را حذف کنید.");
        if (await userManager.IsInRoleAsync(user, Administrator) && await CountAdministratorsAsync() <= 1)
            return Fail("حذف آخرین مدیر مجاز نیست.");

        // Revoke the user's OpenIddict authorizations (their access/refresh tokens cascade) — the
        // grant rows cascade via the FK, but authorizations key off the subject string, not the FK.
        await foreach (var authorization in
            authorizationManager.FindBySubjectAsync(user.Id, HttpContext.RequestAborted))
        {
            await authorizationManager.TryRevokeAsync(authorization, HttpContext.RequestAborted);
        }

        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded) return IdentityError(result);

        return NoContent();
    }

    // ── Reference data ───────────────────────────────────────────────────────────

    [HttpGet("roles")]
    public async Task<ActionResult<IEnumerable<string>>> GetRoles() =>
        Ok(await roleManager.Roles
            .OrderBy(r => r.Name)
            .Select(r => r.Name)
            .ToListAsync(HttpContext.RequestAborted));

    [HttpGet("services")]
    public ActionResult<IReadOnlyList<ServiceKey>> GetServices() => Ok(ServiceKeys.All);

    // ── Helpers ────────────────────────────────────────────────────────────────

    private async Task<UserDto> ToDtoAsync(AuthUser user) => new(
        user.Id,
        user.UserName,
        user.Email,
        user.PhoneNumber,
        user.EmailConfirmed,
        // "Locked" = the account is actually disabled right now (LockoutEnd is in the future).
        // NOT LockoutEnabled, which only means the account is eligible for lockout (true for everyone).
        user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow,
        [.. await userManager.GetRolesAsync(user)],
        [.. await serviceAccess.GetServiceKeysAsync(user.Id, HttpContext.RequestAborted)]);

    private async Task<string?> FirstInvalidRoleAsync(IEnumerable<string> roles)
    {
        foreach (var role in roles)
            if (!await roleManager.RoleExistsAsync(role))
                return role;
        return null;
    }

    private async Task<int> CountAdministratorsAsync() =>
        (await userManager.GetUsersInRoleAsync(Administrator)).Count;

    private static List<string> Distinct(IEnumerable<string>? values) =>
        (values ?? [])
        .Where(v => !string.IsNullOrWhiteSpace(v))
        .Select(v => v.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private string? CallerName => User.Identity?.Name ?? User.FindFirst(Claims.Subject)?.Value;

    private bool IsSelf(AuthUser user) =>
        string.Equals(user.Id, User.FindFirst(Claims.Subject)?.Value, StringComparison.Ordinal);

    private ObjectResult Fail(string message) =>
        Problem(detail: message, statusCode: StatusCodes.Status400BadRequest);

    private ObjectResult IdentityError(IdentityResult result) =>
        Problem(detail: string.Join("؛ ", result.Errors.Select(e => e.Description)),
            statusCode: StatusCodes.Status400BadRequest);
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

public record UserDto(
    string Id,
    string? UserName,
    string? Email,
    string? PhoneNumber,
    bool EmailConfirmed,
    bool IsLocked,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string> Services);

public record PagedUsers(IReadOnlyList<UserDto> Items, int Total, int Page, int PageSize);

public record CreatedUser(string Id);

public record CreateUserRequest(
    string UserName,
    string? Email,
    string? PhoneNumber,
    string? Password,
    IReadOnlyList<string>? Roles,
    IReadOnlyList<string>? Services);

public record UpdateUserRequest(
    string? Email,
    string? PhoneNumber,
    string? UserName,
    bool? Locked);

public record RolesRequest(IReadOnlyList<string>? Roles);

public record ServicesRequest(IReadOnlyList<string>? Services);

public record ResetPasswordRequest(string NewPassword);
