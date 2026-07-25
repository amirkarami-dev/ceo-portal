using Mabhas19.Auth.Data;
using Mabhas19.Auth.Otp;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Auth.Pages.Account;

public class OtpModel(
    IOtpService otpService,
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager) : PageModel
{
    [BindProperty] public string Phone { get; set; } = "";
    [BindProperty] public string Code { get; set; } = "";

    public bool CodeSent { get; private set; }
    public string? ErrorMessage { get; private set; }

    public IActionResult OnGet(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        return Page();
    }

    /// <summary>Step 1: request an OTP for the given phone number.</summary>
    public async Task<IActionResult> OnPostRequestAsync(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;

        if (string.IsNullOrWhiteSpace(Phone))
        {
            ErrorMessage = "لطفاً شماره موبایل را وارد کنید.";
            return Page();
        }

        await otpService.RequestAsync(Phone.Trim());
        CodeSent = true;
        return Page();
    }

    /// <summary>Step 2: verify the OTP and sign in.</summary>
    public async Task<IActionResult> OnPostVerifyAsync(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        CodeSent = true; // keep the code field visible on error

        if (string.IsNullOrWhiteSpace(Phone) || string.IsNullOrWhiteSpace(Code))
        {
            ErrorMessage = "لطفاً شماره موبایل و کد را وارد کنید.";
            return Page();
        }

        var ok = await otpService.VerifyAsync(Phone.Trim(), Code.Trim());
        if (!ok)
        {
            ErrorMessage = "کد وارد شده اشتباه یا منقضی شده است.";
            return Page();
        }

        var phone = Phone.Trim();
        var user = await userManager.Users.FirstOrDefaultAsync(u => u.PhoneNumber == phone);
        if (user is null)
        {
            user = new AuthUser
            {
                UserName = phone,
                PhoneNumber = phone,
                PhoneNumberConfirmed = true
            };
            var createResult = await userManager.CreateAsync(user);
            if (!createResult.Succeeded)
            {
                ErrorMessage = "خطا در ایجاد حساب کاربری.";
                return Page();
            }
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        return LocalRedirect(returnUrl ?? "/");
    }
}
