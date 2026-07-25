namespace Mabhas19.Auth.Otp;

public class OtpOptions
{
    public const string SectionName = "Otp";

    public int CodeLength { get; set; } = 5;
    public int TtlSeconds { get; set; } = 120;

    /// <summary>Minimum seconds between successive code requests for the same phone number.</summary>
    public int ResendCooldownSeconds { get; set; } = 60;

    /// <summary>Maximum codes that may be sent to a phone number within the cooldown window's hour.</summary>
    public int MaxSendsPerHour { get; set; } = 5;

    /// <summary>Maximum failed verification attempts before the active code is invalidated.</summary>
    public int MaxVerifyAttempts { get; set; } = 5;

    /// <summary>When true, the generated code is logged (development convenience). Off by default.</summary>
    public bool LogCode { get; set; }
}
