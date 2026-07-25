using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.RateLimiting;

namespace Mabhas19.Auth.Pages.Account;

/// <summary>
/// Auto-authorization landing for the FarsNezam magic-link. Reached from the OIDC authorize
/// endpoint when an unauthenticated request carries login_hint=fars:&lt;CodeOzveyat&gt;. It
/// validates the code against FarsNezam, provisions/locates the IdP account (UserName=CodeMeli,
/// Email=&lt;CodeMeli&gt;@mabhas19.myceo.ir), signs the user in, then resumes the OIDC flow.
/// NOTE: per the accepted design, there is no signature on the link — co alone authorizes.
/// </summary>
[EnableRateLimiting("fars-login")]
public class FarsLoginModel(
    IFarsNezamDirectory directory,
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager) : PageModel
{
    public string? ErrorMessage { get; private set; }

    public async Task<IActionResult> OnGetAsync(string? co, string? returnUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(co))
        {
            ErrorMessage = "کد عضویت ارسال نشده است.";
            return Page();
        }

        var engineer = await directory.GetByCodeOzveyatAsync(co.Trim(), ct);
        if (engineer is null)
        {
            ErrorMessage = "مهندسی با این کد عضویت در سامانه نظام مهندسی فارس یافت نشد.";
            return Page();
        }

        var userName = engineer.CodeMeli;
        var farsEmail = $"{userName}@mabhas19.myceo.ir";
        var user = await userManager.FindByNameAsync(userName);

        // Guard against hijacking a NON-FarsNezam account (password/OTP/Google) that happens to
        // share this username: only auto-sign-in accounts provisioned with the FarsNezam email.
        if (user is not null && !string.Equals(user.Email, farsEmail, StringComparison.OrdinalIgnoreCase))
        {
            ErrorMessage = "این کد عضویت با یک حساب کاربری دیگر تداخل دارد و امکان ورود خودکار نیست.";
            return Page();
        }

        if (user is null)
        {
            user = new AuthUser
            {
                UserName = userName,
                Email = farsEmail,
                EmailConfirmed = true,
                PhoneNumber = engineer.Mob,
            };
            var result = await userManager.CreateAsync(user);
            if (!result.Succeeded)
            {
                ErrorMessage = "خطا در ایجاد حساب کاربری.";
                return Page();
            }
        }

        await signInManager.SignInAsync(user, isPersistent: true);

        // returnUrl is the original OIDC authorize URL (a local path+query) — resume the flow.
        if (!string.IsNullOrWhiteSpace(returnUrl) && Url.IsLocalUrl(returnUrl))
        {
            return LocalRedirect(returnUrl);
        }
        return Redirect("/");
    }
}
