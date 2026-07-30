using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
using Mabhas19.Auth.Otp;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Mabhas19.Auth.Pages.Account;

/// <summary>
/// OTP login for the engineer-facing services, keyed by کد ملی instead of a mobile number. The IdP
/// resolves the engineer's mobile itself — from the auth user when one exists, otherwise from the
/// KurdNezam membership DB (which also provisions the account, username = the CodeMeli the org
/// returns).
/// </summary>
/// <remarks>
/// <para>
/// Shared by <c>walfare-web</c> (سامانه رفاهی مهندسین) and <c>election-web</c> (سامانه انتخابات). The
/// caller passes <c>service</c> so the page can name the service it is signing the person into, and so
/// a freshly provisioned account is granted **only** that service — provisioning an election voter
/// with a welfare grant would hand them a service they never asked for.
/// </para>
/// <para>
/// This is the only usable door for an engineer: accounts created here have **no password**, and the
/// generic <c>/Account/Otp</c> page keys on a mobile number and would create a user whose username is
/// that number. For voting that username is not a کد ملی, so the cast refuses — safe, but the person
/// simply cannot vote. Hence the client → this page routing in <c>AuthorizationController</c>.
/// </para>
/// </remarks>
public class EngineerLoginModel(
    IKurdNezamDirectory directory,
    IOtpService otpService,
    IServiceAccessStore serviceAccess,
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager) : PageModel
{
    /// <summary>
    /// The service this login is for: heading text, and the single grant a new account receives.
    /// </summary>
    /// <remarks>
    /// Keyed on a short opaque hint rather than the raw <c>client_id</c> so the page cannot be talked
    /// into granting an arbitrary service key by a crafted query string — an unknown value falls back
    /// to welfare, which is what every existing engineer account already has.
    /// </remarks>
    private static readonly Dictionary<string, (string Heading, string Grant)> Services =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["walfare"]  = ("سامانه رفاهی مهندسین", ServiceKeys.Walfare),
            ["election"] = ("سامانه انتخابات", ServiceKeys.Election),
        };

    [BindProperty] public string NationalCode { get; set; } = "";
    [BindProperty] public string Code { get; set; } = "";

    /// <summary>Round-tripped through the form so an error re-render keeps the right heading and grant.</summary>
    [BindProperty(SupportsGet = true)] public string? Service { get; set; }

    public bool CodeSent { get; private set; }
    public string? MaskedPhone { get; private set; }
    public string? ErrorMessage { get; private set; }

    public string Heading => Resolved.Heading;

    private (string Heading, string Grant) Resolved =>
        Service is not null && Services.TryGetValue(Service, out var s) ? s : Services["walfare"];

    public IActionResult OnGet(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        return Page();
    }

    /// <summary>Step 1: resolve the engineer from the کد ملی and send the OTP to their mobile.</summary>
    public async Task<IActionResult> OnPostRequestAsync(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;

        var code = NormalizeDigits(NationalCode);
        if (code.Length != 10 || !code.All(char.IsAsciiDigit))
        {
            ErrorMessage = "کد ملی باید ۱۰ رقم باشد.";
            return Page();
        }
        NationalCode = code;

        var (user, phone, error) = await ResolveEngineerAsync(code, provisionIfMissing: true);
        if (error is not null || user is null || phone is null)
        {
            ErrorMessage = error ?? "امکان ورود وجود ندارد.";
            return Page();
        }

        await otpService.RequestAsync(phone);
        CodeSent = true;
        MaskedPhone = Mask(phone);
        return Page();
    }

    /// <summary>Step 2: verify the OTP against the SERVER-derived mobile and sign in.</summary>
    public async Task<IActionResult> OnPostVerifyAsync(string? returnUrl = null)
    {
        ViewData["ReturnUrl"] = returnUrl;
        CodeSent = true; // keep the code field visible on error

        var code = NormalizeDigits(NationalCode);
        var otp = NormalizeDigits(Code);
        if (code.Length != 10 || string.IsNullOrWhiteSpace(otp))
        {
            ErrorMessage = "لطفاً کد تأیید را وارد کنید.";
            return Page();
        }

        // Re-derive the phone from the national code — the phone NEVER travels through the form,
        // so a tampered hidden field cannot redirect the OTP check to an attacker's number.
        var (user, phone, error) = await ResolveEngineerAsync(code, provisionIfMissing: false);
        if (error is not null || user is null || phone is null)
        {
            ErrorMessage = error ?? "امکان ورود وجود ندارد.";
            return Page();
        }
        MaskedPhone = Mask(phone);

        if (!await otpService.VerifyAsync(phone, otp))
        {
            ErrorMessage = "کد وارد شده اشتباه یا منقضی شده است.";
            return Page();
        }

        await signInManager.SignInAsync(user, isPersistent: true);
        return LocalRedirect(returnUrl ?? "/");
    }

    /// <summary>
    /// Username lookup, with provisioning from the membership DB when allowed. Also backfills a
    /// missing phone from the org record, since OTP is the only way in here.
    /// </summary>
    private async Task<(AuthUser? User, string? Phone, string? Error)> ResolveEngineerAsync(
        string nationalCode, bool provisionIfMissing)
    {
        var user = await userManager.FindByNameAsync(nationalCode);

        if (user is null)
        {
            var engineer = await directory.GetByNationalCodeAsync(nationalCode, HttpContext.RequestAborted);
            if (engineer is null)
                return (null, null, "این کد ملی در سامانه نظام مهندسی یافت نشد.");

            // The org's CodeMeli is canonical (it may differ from the typed value in formatting),
            // so a pre-existing account is searched under it too before creating anything.
            user = await userManager.FindByNameAsync(engineer.CodeMeli);

            if (user is null)
            {
                if (!provisionIfMissing)
                    return (null, null, "حساب کاربری یافت نشد. لطفاً دوباره از ابتدا وارد شوید.");

                if (string.IsNullOrWhiteSpace(engineer.Mob))
                    return (null, null, "شماره موبایلی برای این کد ملی ثبت نشده است. لطفاً با سازمان تماس بگیرید.");

                user = new AuthUser
                {
                    UserName = engineer.CodeMeli,
                    PhoneNumber = engineer.Mob,
                    PhoneNumberConfirmed = true,
                    Email = string.IsNullOrWhiteSpace(engineer.Email) ? null : engineer.Email
                };
                var created = await userManager.CreateAsync(user);
                if (!created.Succeeded)
                    return (null, null, "خطا در ایجاد حساب کاربری.");

                // A fresh engineer account gets ONLY the service they came in through — an empty grant
                // list would mean "all services" under the grandfather rule. Note this does NOT gate
                // voting: `election` is deliberately unmapped in ServiceKeys.ClientToKey, so an
                // engineer holding ["walfare"] can still vote. The grant is about what the launcher
                // offers them, not about who may cast a ballot.
                await serviceAccess.ReplaceAsync(user.Id, [Resolved.Grant], "engineer-login",
                    HttpContext.RequestAborted);
            }
        }

        var phone = user.PhoneNumber;
        if (string.IsNullOrWhiteSpace(phone))
        {
            // Existing account without a phone: the org record is the only usable source.
            var engineer = await directory.GetByNationalCodeAsync(nationalCode, HttpContext.RequestAborted);
            phone = engineer?.Mob;
            if (string.IsNullOrWhiteSpace(phone))
                return (user, null, "شماره موبایلی برای این کد ملی ثبت نشده است. لطفاً با سازمان تماس بگیرید.");

            user.PhoneNumber = phone;
            user.PhoneNumberConfirmed = true;
            await userManager.UpdateAsync(user);
        }

        return (user, phone, null);
    }

    /// <summary>Persian/Arabic digits arrive from fa keyboards; the DB and OTP store hold Latin.</summary>
    private static string NormalizeDigits(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        Span<char> buffer = stackalloc char[value.Length];
        var n = 0;
        foreach (var ch in value.Trim())
        {
            buffer[n++] = ch switch
            {
                >= '۰' and <= '۹' => (char)('0' + (ch - '۰')), // ۰-۹
                >= '٠' and <= '٩' => (char)('0' + (ch - '٠')), // ٠-٩
                _ => ch
            };
        }
        return new string(buffer[..n]);
    }

    /// <summary>"09189981803" → "0918•••1803" — enough to recognise, not enough to harvest.</summary>
    private static string? Mask(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return null;
        var p = phone.Trim();
        return p.Length < 8 ? "•••" : $"{p[..4]}•••{p[^4..]}";
    }
}
