using Ardalis.GuardClauses;
using MediatR;
using Microsoft.Extensions.Logging;
using Shouldly;
using Mabhas19.Application.Common.Behaviours;
using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Security;
using NUnit.Framework;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.UnitTests.Common.Behaviours;

/// <summary>
/// What reaches the application log when a request fails.
/// </summary>
/// <remarks>
/// This mattered in production. Every refusal was logged at Error with a stack trace and the whole
/// request, so two everyday events wrote user data into the log: a member clicking an EXPIRED
/// guesthouse payment link recorded their live payment token, and a mistyped کد ملی recorded that
/// person's name, national code and mobile. Neither is a fault — the caller got a 4xx explaining it.
/// </remarks>
public class UnhandledExceptionBehaviourTests
{
    private const string NationalCode = "0012345678";
    private const string PaymentToken = "tok-not-real";

    private record FakeCommand(string NationalCode, string PaymentToken) : IRequest<Unit>;

    private record FakeSecretCommand(string NationalCode) : IRequest<Unit>, ISecretRequest;

    private record FakeSensitiveCommand(string NationalCode, string PaymentToken)
        : IRequest<Unit>, ISensitivePayloadRequest;

    /// <summary>Records what was logged, so the assertions can read the real formatted line.</summary>
    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public readonly List<(LogLevel Level, string Message, Exception? Error)> Entries = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }

    private static ValidationException ValidationOn(params string[] fields)
    {
        var failures = fields
            .Select(f => new FluentValidation.Results.ValidationFailure(f, "پیام فارسی"))
            .ToList();
        return new ValidationException(failures);
    }

    private static async Task<RecordingLogger<FakeCommand>> RunAsync(Exception thrown)
    {
        var logger = new RecordingLogger<FakeCommand>();
        var behaviour = new UnhandledExceptionBehaviour<FakeCommand, Unit>(logger);
        var request = new FakeCommand(NationalCode, PaymentToken);

        await Should.ThrowAsync<Exception>(
            () => behaviour.Handle(request, _ => throw thrown, CancellationToken.None));

        return logger;
    }

    [Test]
    public async Task A_validation_refusal_is_information_not_error()
    {
        var logger = await RunAsync(ValidationOn("Token"));

        logger.Entries.Count.ShouldBe(1);
        logger.Entries[0].Level.ShouldBe(LogLevel.Information);
        // No stack trace attached either — the exception is not the point of the line.
        logger.Entries[0].Error.ShouldBeNull();
    }

    [Test]
    public async Task A_validation_refusal_names_the_field_but_never_its_value()
    {
        var logger = await RunAsync(ValidationOn("Token", "NationalCode"));
        var line = logger.Entries.Single().Message;

        line.ShouldContain("Token");
        line.ShouldContain("NationalCode");

        // The whole reason this test exists.
        line.ShouldNotContain(PaymentToken);
        line.ShouldNotContain(NationalCode);
    }

    [TestCaseSource(nameof(ExpectedRefusals))]
    public async Task Every_exception_the_api_answers_as_4xx_is_a_refusal(Exception refusal)
    {
        var logger = await RunAsync(refusal);

        logger.Entries.Single().Level.ShouldBe(LogLevel.Information);
        logger.Entries.Single().Message.ShouldNotContain(NationalCode);
    }

    private static IEnumerable<Exception> ExpectedRefusals() =>
    [
        ValidationOn("Field"),
        new NotFoundException("7", "GuesthouseRequest"),
        new KeyNotFoundException("missing"),
        new UnauthorizedAccessException(),
        new ForbiddenAccessException(),
    ];

    [Test]
    public async Task A_real_fault_is_still_an_error_and_still_carries_the_request()
    {
        var boom = new InvalidOperationException("boom");

        var logger = await RunAsync(boom);
        var entry = logger.Entries.Single();

        entry.Level.ShouldBe(LogLevel.Error);
        entry.Error.ShouldBeSameAs(boom);
        // Diagnosing a genuine 500 needs the payload; that trade is unchanged.
        entry.Message.ShouldContain(NationalCode);
    }

    [Test]
    public async Task FluentValidations_own_exception_is_a_fault_not_a_refusal()
    {
        // ProblemDetailsExceptionHandler does not map it, so one escaping really is a 500. If this
        // ever starts failing, the handler and IsExpectedRefusal have drifted apart.
        var logger = await RunAsync(new FluentValidation.ValidationException("escaped"));

        logger.Entries.Single().Level.ShouldBe(LogLevel.Error);
    }

    [Test]
    public async Task A_secret_requests_refusal_does_not_even_name_the_fields()
    {
        var logger = new RecordingLogger<FakeSecretCommand>();
        var behaviour = new UnhandledExceptionBehaviour<FakeSecretCommand, Unit>(logger);

        await Should.ThrowAsync<ValidationException>(
            () => behaviour.Handle(
                new FakeSecretCommand(NationalCode),
                _ => throw ValidationOn("CandidateIds"),
                CancellationToken.None));

        var entry = logger.Entries.Single();
        entry.Level.ShouldBe(LogLevel.Information);
        entry.Message.ShouldNotContain("CandidateIds");
        entry.Message.ShouldNotContain(NationalCode);
    }

    [Test]
    public async Task A_sensitive_payload_never_reaches_the_log_even_on_a_real_fault()
    {
        // The fault path deliberately logs {@Request} so a 500 can be diagnosed. For a request
        // whose payload IS the secret — a کد ملی, or a payment token that is a bearer credential —
        // that trade is wrong, and this proves the marker overrides it.
        var logger = new RecordingLogger<FakeSensitiveCommand>();
        var behaviour = new UnhandledExceptionBehaviour<FakeSensitiveCommand, Unit>(logger);

        await Should.ThrowAsync<InvalidOperationException>(
            () => behaviour.Handle(
                new FakeSensitiveCommand(NationalCode, PaymentToken),
                _ => throw new InvalidOperationException("boom"),
                CancellationToken.None));

        var entry = logger.Entries.Single();
        entry.Level.ShouldBe(LogLevel.Error);          // still an error — the fault is not hidden
        entry.Message.ShouldContain("FakeSensitiveCommand");
        entry.Message.ShouldNotContain(NationalCode);
        entry.Message.ShouldNotContain(PaymentToken);
    }
}
