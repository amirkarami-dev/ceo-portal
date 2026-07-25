namespace Mabhas19.Auth.External;

public record GoogleUserInfo(string Subject, string Email, bool EmailVerified, string? Name, string? Picture);

/// <summary>Validates a Google ID token and returns the verified user info.</summary>
public interface IGoogleTokenValidator
{
    Task<GoogleUserInfo?> ValidateAsync(string idToken, CancellationToken ct = default);
}
