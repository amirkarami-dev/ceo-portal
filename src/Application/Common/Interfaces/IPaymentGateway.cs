namespace Mabhas19.Application.Common.Interfaces;

/// <summary>Result of asking the gateway for a payment token.</summary>
/// <param name="Success">False when the gateway refused (wrong config, amount, duplicate id…).</param>
/// <param name="Token">Gateway token; the payer's browser is sent to <paramref name="RedirectUrl"/>.</param>
public sealed record PaymentInitResult(bool Success, string? Token, string? RedirectUrl, string? Error);

/// <summary>Result of server-to-server verification after the gateway calls back.</summary>
public sealed record PaymentVerifyResult(bool Success, string? Amount, string? Description);

/// <summary>
/// A redirect-style bank gateway (درگاه پرداخت). Iran Kish today; the payment subsystem only
/// talks to this contract so another gateway is a new implementation, not a rewrite.
/// </summary>
public interface IPaymentGateway
{
    /// <summary>Requests a token for <paramref name="amountRials"/> tied to our unique payment id.</summary>
    Task<PaymentInitResult> InitAsync(long amountRials, string paymentId, CancellationToken ct = default);

    /// <summary>Confirms the purchase with the bank after its callback. MUST be called before trusting it.</summary>
    Task<PaymentVerifyResult> VerifyAsync(
        string retrievalReferenceNumber, string systemTraceAuditNumber, string token, CancellationToken ct = default);
}
