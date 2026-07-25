namespace Mabhas19.Auth.Otp;

/// <summary>One-time-password issuing/verification for mobile login.</summary>
public interface IOtpService
{
    Task RequestAsync(string phoneNumber, CancellationToken ct = default);

    Task<bool> VerifyAsync(string phoneNumber, string code, CancellationToken ct = default);
}
