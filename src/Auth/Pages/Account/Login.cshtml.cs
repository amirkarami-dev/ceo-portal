using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Options;

namespace Mabhas19.Auth.Pages.Account;

public class LoginModel(
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager,
    IGoogleTokenValidator googleTokenValidator,
    IOptions<GoogleAuthOptions> googleOptions) : PageModel
{
    [BindProperty] public string UserName { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";

    public string? ErrorMessage { get; private set; }
    public string? GoogleClientId => googleOptions.Value.ClientId;

    public IActionResult OnGet(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        return Page();
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        if (!ModelState.IsValid) return Page();

        var result = await signInManager.PasswordSignInAsync(
            UserName, Password, isPersistent: true, lockoutOnFailure: true);

        if (result.Succeeded)
            return LocalRedirect(returnUrl ?? "/");

        if (result.IsLockedOut)
            ErrorMessage = "حساب کاربری شما موقتاً قفل شده است. لطفاً بعداً تلاش کنید.";
        else
            ErrorMessage = "نام کاربری یا رمز عبور اشتباه است.";

        ViewData["ReturnUrl"] = returnUrl;
        return Page();
    }

    public async Task<IActionResult> OnPostGoogleAsync(string credential, string? returnUrl = null)
    {
        if (string.IsNullOrWhiteSpace(credential))
        {
            ErrorMessage = "اطلاعات Google دریافت نشد.";
            ViewData["ReturnUrl"] = returnUrl;
            return Page();
        }

        var info = await googleTokenValidator.ValidateAsync(credential);
        if (info is null)
        {
            ErrorMessage = "احراز هویت Google ناموفق بود.";
            ViewData["ReturnUrl"] = returnUrl;
            return Page();
        }

        var user = await userManager.FindByEmailAsync(info.Email);
        if (user is null)
        {
            user = new AuthUser
            {
                UserName = info.Email,
                Email = info.Email,
                EmailConfirmed = info.EmailVerified
            };
            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                ErrorMessage = "خطا در ایجاد حساب کاربری.";
                ViewData["ReturnUrl"] = returnUrl;
                return Page();
            }
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        return LocalRedirect(returnUrl ?? "/");
    }
}
