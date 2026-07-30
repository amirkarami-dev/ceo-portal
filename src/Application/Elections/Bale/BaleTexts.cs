namespace Mabhas19.Application.Elections.Bale;

/// <summary>
/// Every message the bot sends, in one place.
/// </summary>
/// <remarks>
/// Kept together so the wording can be reviewed as a whole. Two rules that are easy to break one message
/// at a time:
/// <list type="bullet">
/// <item>
/// <b>Never echo the کد ملی back.</b> It would sit in the chat history on the device and on Bale's
/// servers. Masked forms only.
/// </item>
/// <item>
/// <b>"Not found" and "unavailable" must never share wording.</b> `GOTCHAS.md` records
/// «این کد ملی یافت نشد» once being shown for what was really a database fault; during an election that
/// would tell every voter they are not a member.
/// </item>
/// </list>
/// </remarks>
public static class BaleTexts
{
    public const string Welcome =
        "به سامانهٔ انتخابات سازمان نظام مهندسی خوش آمدید.\n\n" +
        "برای شروع، کد ملی خود را ارسال کنید (۱۰ رقم).";

    public const string AskNationalCode = "کد ملی خود را ارسال کنید (۱۰ رقم).";

    public const string BadNationalCode = "کد ملی باید ۱۰ رقم باشد. لطفاً دوباره ارسال کنید.";

    public const string NotFound =
        "این کد ملی در سامانهٔ نظام مهندسی یافت نشد. اگر عضو سازمان هستید، با واحد عضویت تماس بگیرید.";

    /// <summary>Deliberately different wording from <see cref="NotFound"/> — see the class remarks.</summary>
    public const string DirectoryUnavailable =
        "در حال حاضر امکان بررسی اطلاعات عضویت وجود ندارد. این یک اشکال موقت سامانه است؛ چند دقیقهٔ دیگر" +
        " دوباره تلاش کنید.";

    public const string NoMobileOnRecord =
        "شماره موبایلی برای این کد ملی در سازمان ثبت نشده است، بنابراین کد تأیید قابل ارسال نیست." +
        " لطفاً با واحد عضویت تماس بگیرید.";

    public const string VotingUnavailable =
        "سامانهٔ رأی‌گیری در حال حاضر در دسترس نیست. لطفاً بعداً تلاش کنید.";

    public const string OtpRateLimited =
        "تعداد درخواست‌های کد تأیید شما زیاد بوده است. لطفاً کمی بعد دوباره تلاش کنید.";

    public const string OtpLockedOut =
        "به دلیل تلاش‌های ناموفق زیاد، ارسال کد تأیید موقتاً مسدود شده است. بعداً دوباره تلاش کنید.";

    public const string OtpWrong = "کد تأیید اشتباه یا منقضی شده است. دوباره وارد کنید.";

    public const string AskOtp = "کد ۵ رقمی ارسال‌شده را وارد کنید.";

    /// <summary>
    /// Shown when a code was requested again within the resend cooldown. The earlier code is still
    /// valid, so this must read as "use the one you have", not as an error.
    /// </summary>
    public const string OtpAlreadySent =
        "کد تأیید قبلی همچنان معتبر است. " + AskOtp;

    public const string SessionExpired =
        "نشست شما منقضی شده است. برای شروع دوباره /start را بفرستید.";

    /// <summary>
    /// A group chat is refused outright: everyone in the room would read the same messages and share one
    /// session, so one person could identify and anybody else could cast their ballot.
    /// </summary>
    public const string PrivateChatOnly =
        "رأی‌گیری فقط در گفتگوی خصوصی با ربات امکان‌پذیر است. لطفاً به صورت خصوصی به ربات پیام دهید.";

    /// <summary>Shown when a candidate is changed after a vote code was already sent.</summary>
    public const string SelectionChanged =
        "انتخاب شما تغییر کرد، بنابراین کد تأیید قبلی لغو شد. پس از نهایی کردن انتخاب، دوباره «ثبت رأی» را بزنید.";

    public const string NoElections =
        "در حال حاضر انتخاباتی که شما بتوانید در آن رأی دهید وجود ندارد.";

    public const string ChooseElection = "یکی از انتخابات زیر را انتخاب کنید:";

    public const string AlreadyVoted = "شما قبلاً در این انتخابات رأی داده‌اید.";

    public const string SelectionEmpty = "هنوز کاندیدایی انتخاب نکرده‌اید.";

    public const string VoteRecorded =
        "✅ رأی شما ثبت شد.\n\n" +
        "رأی شما به صورت رمزنگاری‌شده ذخیره شده و سامانه نمی‌تواند آن را به نام شما بازگرداند." +
        " رأی ثبت‌شده قابل تغییر نیست.";

    public const string Unknown =
        "دستور شناخته نشد. برای شروع /start را بفرستید.";

    public static string OtpSent(bool viaBale, bool viaSms) => (viaBale, viaSms) switch
    {
        // Telling the user which channel worked matters: someone whose Bale push failed would otherwise
        // sit waiting for a message that is already in their SMS inbox.
        (true, true) => "کد تأیید هم در همین گفتگو و هم با پیامک ارسال شد. " + AskOtp,
        (true, false) => "کد تأیید در همین گفتگو ارسال شد (ارسال پیامک ناموفق بود). " + AskOtp,
        (false, true) => "کد تأیید با پیامک ارسال شد. " + AskOtp,
        _ => "ارسال کد تأیید ناموفق بود. لطفاً چند دقیقهٔ دیگر دوباره تلاش کنید."
    };

    public static string OtpCode(string code) => $"کد تأیید رأی‌گیری شما: {code}";

    public static string IdentityConfirmed(string fullName) =>
        $"سلام {fullName}.\n\nهویت شما تأیید شد.";

    public static string ElectionHeader(string title, string window, int maxSelections) =>
        maxSelections > 1
            ? $"«{title}»\n{window}\n\nحداکثر {ToFa(maxSelections)} کاندیدا انتخاب کنید، سپس «ثبت رأی» را بزنید."
            : $"«{title}»\n{window}\n\nیک کاندیدا انتخاب کنید، سپس «ثبت رأی» را بزنید.";

    public static string ConfirmVote(IReadOnlyList<string> names) =>
        "رأی شما به این افراد ثبت می‌شود:\n" +
        string.Join("\n", names.Select(n => $"• {n}")) +
        "\n\n⚠️ پس از ثبت، رأی قابل تغییر نیست.\nبرای تأیید نهایی، کد ارسال‌شده را وارد کنید.";

    public static string CapReached(int max) => $"حداکثر {ToFa(max)} کاندیدا می‌توانید انتخاب کنید.";

    private static string ToFa(int n) => n.ToString("N0", new System.Globalization.CultureInfo("fa-IR"));
}
