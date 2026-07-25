using Mabhas19.Auth.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Mabhas19.Auth.Pages.Account;

public class LogoutModel(SignInManager<AuthUser> signInManager) : PageModel
{
    public async Task<IActionResult> OnPostAsync()
    {
        await signInManager.SignOutAsync();
        return LocalRedirect("/");
    }
}
