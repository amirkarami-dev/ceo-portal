using MediatR;
using Microsoft.Extensions.Logging;
using Shouldly;
using Mabhas19.Application.Common.Behaviours;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Common.Behaviours;

/// <summary>
/// What every request writes to the log before it is even handled.
/// </summary>
/// <remarks>
/// This is where the guesthouse data leak actually lived. Suppressing it on the FAULT path was not
/// enough: <c>LoggingBehaviour</c> writes <c>{@Request}</c> for every request, success or failure,
/// so a payment token and a کد ملی were recorded on the way in regardless of the outcome.
/// </remarks>
public class LoggingBehaviourTests
{
    private const string NationalCode = "0012345678";
    private const string PaymentToken = "tok-not-real";

    private record OrdinaryCommand(string PoolName) : IRequest<Unit>;

    private record SensitiveCommand(string NationalCode, string PaymentToken)
        : IRequest<Unit>, ISensitivePayloadRequest;

    private record SecretCommand(string CandidateId) : IRequest<Unit>, ISecretRequest;

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public readonly List<string> Messages = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Messages.Add(formatter(state, exception));
    }

    private sealed class FakeUser : IUser
    {
        public string? Id => "user-1";
        // For engineer accounts the IdP's username IS the کد ملی. That is why ISecretRequest
        // suppresses the whole line and not just the payload.
        public string? Name => NationalCode;
        public List<string>? Roles => [];
    }

    private static async Task<List<string>> LogOf<T>(T request) where T : notnull
    {
        var logger = new RecordingLogger<T>();
        await new LoggingBehaviour<T>(logger, new FakeUser()).Process(request, CancellationToken.None);
        return logger.Messages;
    }

    [Test]
    public async Task An_ordinary_request_still_logs_its_payload()
    {
        // Losing this everywhere would be a real cost, so the default is unchanged.
        var messages = await LogOf(new OrdinaryCommand("استخر آزادی"));

        messages.Single().ShouldContain("OrdinaryCommand");
        messages.Single().ShouldContain("استخر آزادی");
    }

    [Test]
    public async Task A_sensitive_request_logs_that_it_happened_but_not_what_was_in_it()
    {
        var messages = await LogOf(new SensitiveCommand(NationalCode, PaymentToken));
        var line = messages.Single();

        // The audit trail survives: the request name and the acting user are still there.
        line.ShouldContain("SensitiveCommand");
        line.ShouldContain("user-1");

        // The payload does not. This is the whole point.
        line.ShouldNotContain(PaymentToken);
    }

    [Test]
    public async Task A_secret_request_writes_no_line_at_all()
    {
        // Unchanged behaviour, asserted so the new branch above cannot erode it: for a vote even
        // "name + user + timestamp" is a voter roll.
        (await LogOf(new SecretCommand("candidate-3"))).ShouldBeEmpty();
    }
}
