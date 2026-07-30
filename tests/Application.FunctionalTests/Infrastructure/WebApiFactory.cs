using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

public class WebApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    /// <summary>
    /// Shared fake membership directory, so a test can seed engineers and simulate an outage.
    /// </summary>
    /// <remarks>
    /// A single instance rather than one per scope: <c>IEngineerDirectory</c> is resolved per request,
    /// but a test needs to arrange the data once and have every later scope see it.
    /// </remarks>
    public FakeEngineerDirectory Directory { get; } = new();

    /// <summary>What the bot would have sent to Bale.</summary>
    public FakeBaleClient Bale { get; } = new();

    /// <summary>Records issued OTP codes while keeping the real limit logic.</summary>
    public RecordingVoteOtpStore? Otp { get; private set; }

    /// <summary>Records OTP delivery without reaching Bale or an SMS provider.</summary>
    public FakeVoteOtpSender OtpSender { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder
            .UseSetting("ConnectionStrings:CeoDb", connectionString)
            // Fixed, throwaway 32-byte keys. Voting refuses to run without both (sealing under a
            // default key would produce ballots anyone could open), so the crypto has to be configured
            // for any vote test to reach the handler at all. These two MUST differ — reusing one value
            // would make the roll and the ballots share key material.
            .UseSetting("Elections:VoterPepper", TestKeys.VoterPepper)
            .UseSetting("Elections:BallotMasterKey", TestKeys.BallotMasterKey);

        builder.ConfigureTestServices(services =>
        {
            services
                .RemoveAll<IUser>()
                .AddTransient(provider =>
                {
                    var mock = new Mock<IUser>();
                    mock.SetupGet(x => x.Roles).Returns(TestApp.GetRoles());
                    mock.SetupGet(x => x.Id).Returns(TestApp.GetUserId());
                    // Engineer accounts use the کد ملی as the username, and the vote path reads it from
                    // here. Without this the cast refuses every request with
                    // «حساب کاربری شما برای رأی دادن معتبر نیست».
                    mock.SetupGet(x => x.Name).Returns(TestApp.GetUserName());
                    return mock.Object;
                });

            services
                .RemoveAll<IEngineerDirectory>()
                .AddSingleton<IEngineerDirectory>(Directory);

            // The Bale bot's outbound edges. The OTP STORE is deliberately the real one, wrapped in a
            // recorder: the cooldown, the send caps and the lockout are behaviour worth testing, and a
            // reimplemented fake would test the fake instead.
            services
                .RemoveAll<IBaleClient>()
                .AddSingleton<IBaleClient>(Bale);

            services
                .RemoveAll<IVoteOtpSender>()
                .AddSingleton<IVoteOtpSender>(OtpSender);

            CaptureOtpStore(services);
        });
    }

    /// <summary>
    /// Replaces the registered <see cref="IVoteOtpStore"/> with a recorder around the real one, and keeps
    /// a handle on it so tests can read the codes that were issued.
    /// </summary>
    private void CaptureOtpStore(IServiceCollection services)
    {
        var original = services.Single(d => d.ServiceType == typeof(IVoteOtpStore));
        services.Remove(original);

        services.AddSingleton<IVoteOtpStore>(provider =>
        {
            var real = (IVoteOtpStore)ActivatorUtilities.CreateInstance(
                provider, original.ImplementationType!);

            Otp = new RecordingVoteOtpStore(real);
            return Otp;
        });
    }

    /// <summary>Test-only key material. Base64 of 32 bytes each, and deliberately different.</summary>
    internal static class TestKeys
    {
        /// <summary>Bytes 0x00…0x1F.</summary>
        public const string VoterPepper     = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

        /// <summary>Bytes 0xFE descending — nothing in common with the pepper above.</summary>
        public const string BallotMasterKey = "/v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N8=";
    }
}
