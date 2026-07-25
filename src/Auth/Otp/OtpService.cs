using System.Security.Cryptography;
using Mabhas19.Auth.Sms;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Auth.Otp;

public class OtpService : IOtpService
{
    private readonly IDistributedCache _cache;
    private readonly ISmsSender _sms;
    private readonly OtpOptions _options;
    private readonly ILogger<OtpService> _logger;

    public OtpService(
        IDistributedCache cache,
        ISmsSender sms,
        IOptions<OtpOptions> options,
        ILogger<OtpService> logger)
    {
        _cache = cache;
        _sms = sms;
        _options = options.Value;
        _logger = logger;
    }

    private static string Key(string phone) => $"otp:{phone}";
    private static string CooldownKey(string phone) => $"otp:cooldown:{phone}";
    private static string SendCountKey(string phone) => $"otp:sends:{phone}";
    private static string AttemptsKey(string phone) => $"otp:attempts:{phone}";

    public async Task RequestAsync(string phoneNumber, CancellationToken ct = default)
    {
        // Resend cooldown: silently no-op if a code was issued very recently, so a caller
        // cannot spam SMS (and the cost/abuse that implies) by repeating the request.
        if (await _cache.GetStringAsync(CooldownKey(phoneNumber), ct) is not null)
        {
            _logger.LogInformation("OTP request for {Phone} ignored: still within resend cooldown.", phoneNumber);
            return;
        }

        // Hourly send cap per phone number.
        var sends = int.TryParse(await _cache.GetStringAsync(SendCountKey(phoneNumber), ct), out var n) ? n : 0;
        if (sends >= _options.MaxSendsPerHour)
        {
            _logger.LogWarning("OTP send cap reached for {Phone}; request throttled.", phoneNumber);
            return;
        }

        var code = GenerateCode(_options.CodeLength);

        await _cache.SetStringAsync(Key(phoneNumber), code, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.TtlSeconds)
        }, ct);

        // A fresh code resets the failed-attempt counter and arms the cooldown / send-count window.
        await _cache.RemoveAsync(AttemptsKey(phoneNumber), ct);
        await _cache.SetStringAsync(CooldownKey(phoneNumber), "1", new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.ResendCooldownSeconds)
        }, ct);
        await _cache.SetStringAsync(SendCountKey(phoneNumber), (sends + 1).ToString(), new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
        }, ct);

        if (_options.LogCode)
        {
            _logger.LogInformation("OTP for {Phone} is {Code}", phoneNumber, code);
        }

        await _sms.SendAsync(phoneNumber, $"کد ورود شما به مبحث ۱۹: {code}", ct);
    }

    public async Task<bool> VerifyAsync(string phoneNumber, string code, CancellationToken ct = default)
    {
        var stored = await _cache.GetStringAsync(Key(phoneNumber), ct);
        if (string.IsNullOrEmpty(stored)) return false;

        // Brute-force guard: too many wrong guesses invalidate the active code.
        var attempts = int.TryParse(await _cache.GetStringAsync(AttemptsKey(phoneNumber), ct), out var a) ? a : 0;
        if (attempts >= _options.MaxVerifyAttempts)
        {
            await _cache.RemoveAsync(Key(phoneNumber), ct);
            _logger.LogWarning("OTP verify attempt cap reached for {Phone}; code invalidated.", phoneNumber);
            return false;
        }

        var ok = CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(stored),
            System.Text.Encoding.UTF8.GetBytes(code.Trim()));

        if (ok)
        {
            await _cache.RemoveAsync(Key(phoneNumber), ct);
            await _cache.RemoveAsync(AttemptsKey(phoneNumber), ct);
        }
        else
        {
            await _cache.SetStringAsync(AttemptsKey(phoneNumber), (attempts + 1).ToString(), new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(_options.TtlSeconds)
            }, ct);
        }

        return ok;
    }

    private static string GenerateCode(int length)
    {
        var max = (int)Math.Pow(10, length);
        var value = RandomNumberGenerator.GetInt32(0, max);
        return value.ToString().PadLeft(length, '0');
    }
}
