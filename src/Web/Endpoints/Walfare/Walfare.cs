using Mabhas19.Application.Walfare;
using Mabhas19.Application.Walfare.Payments;
using Mabhas19.Application.Walfare.Pools;
using Mabhas19.Application.Walfare.Reservations;
using Mabhas19.Application.Walfare.Services;
using Mabhas19.Domain.Walfare;
using Mabhas19.Web.Endpoints.Kurdnezam; // RequireAdmin()
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Walfare;

// Handler method names are globally unique on purpose (they become endpoint names/operationIds);
// every handler here carries the Walfare prefix. Same rule the Kurdnezam groups follow.

/// <summary>Welfare offerings (خدمات رفاهی). Engineer sees active ones; admin manages all.</summary>
public class WalfareServices : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/services";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetWalfareActiveServices, string.Empty).RequireAuthorization();
        groupBuilder.MapGet(GetWalfareServicesAdmin, "admin").RequireAdmin();
        groupBuilder.MapPost(CreateWalfareService, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateWalfareService, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteWalfareService, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<WelfareServiceDto>>> GetWalfareActiveServices(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetActiveWelfareServicesQuery()));

    public static async Task<Ok<IReadOnlyList<WelfareServiceDto>>> GetWalfareServicesAdmin(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetWelfareServicesAdminQuery()));

    public static async Task<Created<int>> CreateWalfareService(ISender sender, WelfareServiceInput body)
    {
        var id = await sender.Send(new CreateWelfareServiceCommand(body));
        return TypedResults.Created($"/api/walfare/services/{id}", id);
    }

    public static async Task<NoContent> UpdateWalfareService(ISender sender, int id, WelfareServiceInput body)
    {
        await sender.Send(new UpdateWelfareServiceCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteWalfareService(ISender sender, int id)
    {
        await sender.Send(new DeleteWelfareServiceCommand(id));
        return TypedResults.NoContent();
    }
}

/// <summary>Pools (استخرها): day availability for engineers, CRUD for admins.</summary>
public class WalfarePools : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/pools";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetWalfarePoolsForDate, "for-date").RequireAuthorization();
        groupBuilder.MapGet(GetWalfareServiceCalendar, "calendar").RequireAuthorization();
        groupBuilder.MapGet(GetWalfarePoolsAdmin, "admin").RequireAdmin();
        groupBuilder.MapPost(CreateWalfarePool, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateWalfarePool, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteWalfarePool, "{id:int}").RequireAdmin();
    }

    /// <param name="date">Jalali, e.g. <c>1405/05/01</c> (Persian digits fine).</param>
    public static async Task<Ok<IReadOnlyList<PoolAvailabilityDto>>> GetWalfarePoolsForDate(
        ISender sender, int serviceId, string date)
        => TypedResults.Ok(await sender.Send(new GetPoolsForDateQuery(serviceId, date)));

    /// <summary>Service window + active weekdays, so the booking calendar can badge its days.</summary>
    public static async Task<Ok<ServiceCalendarDto>> GetWalfareServiceCalendar(ISender sender, int serviceId)
        => TypedResults.Ok(await sender.Send(new GetServiceCalendarQuery(serviceId)));

    public static async Task<Ok<IReadOnlyList<WelfarePoolDto>>> GetWalfarePoolsAdmin(
        ISender sender, int? serviceId = null)
        => TypedResults.Ok(await sender.Send(new GetWelfarePoolsAdminQuery(serviceId)));

    public static async Task<Created<int>> CreateWalfarePool(ISender sender, WelfarePoolInput body)
    {
        var id = await sender.Send(new CreateWelfarePoolCommand(body));
        return TypedResults.Created($"/api/walfare/pools/{id}", id);
    }

    public static async Task<NoContent> UpdateWalfarePool(ISender sender, int id, WelfarePoolInput body)
    {
        await sender.Send(new UpdateWelfarePoolCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteWalfarePool(ISender sender, int id)
    {
        await sender.Send(new DeleteWelfarePoolCommand(id));
        return TypedResults.NoContent();
    }
}

/// <summary>The signed-in engineer as the org membership DB knows them.</summary>
public class WalfareMe : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/me";

    public static void Map(RouteGroupBuilder groupBuilder)
        => groupBuilder.MapGet(GetWalfareEngineerMe, string.Empty).RequireAuthorization();

    public static async Task<Ok<WalfareEngineerDto>> GetWalfareEngineerMe(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetWalfareEngineerMeQuery()));
}

/// <summary>Reservations: engineers create/list their own, admins see all.</summary>
public class WalfareReservations : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/reservations";

    public record CreateWalfareReservationRequest(int PoolId, string Date);

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(CreateWalfareReservation, string.Empty).RequireAuthorization();
        groupBuilder.MapGet(GetWalfareMyReservations, "me").RequireAuthorization();
        groupBuilder.MapGet(GetWalfareReservationsAdmin, "admin").RequireAdmin();
    }

    public static async Task<Created<int>> CreateWalfareReservation(
        ISender sender, CreateWalfareReservationRequest body)
    {
        var id = await sender.Send(new CreateReservationCommand(body.PoolId, body.Date));
        return TypedResults.Created($"/api/walfare/reservations/{id}", id);
    }

    public static async Task<Ok<IReadOnlyList<ReservationDto>>> GetWalfareMyReservations(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetMyReservationsQuery()));

    public static async Task<Ok<WalfarePagedResult<ReservationDto>>> GetWalfareReservationsAdmin(
        ISender sender, int? poolId = null, ReservationStatus? status = null, string? q = null,
        int page = 1, int pageSize = 20)
        => TypedResults.Ok(await sender.Send(new GetReservationsAdminQuery(poolId, status, q, page, pageSize)));
}

/// <summary>Payment init + the Iran Kish browser callback + the admin ledger.</summary>
public class WalfarePayments : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/payments";

    public record InitWalfarePaymentRequest(int ReservationId);

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(InitWalfarePayment, "init").RequireAuthorization();
        // The BANK posts the payer's browser here — no token, no antiforgery cookie.
        groupBuilder.MapPost(WalfareIrkReturn, "irk-return").AllowAnonymous().DisableAntiforgery();
        groupBuilder.MapGet(GetWalfarePaymentsAdmin, "admin").RequireAdmin();
        groupBuilder.MapPost(ConfirmWalfarePayment, "{id:int}/confirm").RequireAdmin();
    }

    public static async Task<Ok<PaymentRedirectDto>> InitWalfarePayment(
        ISender sender, InitWalfarePaymentRequest body)
        => TypedResults.Ok(await sender.Send(new InitPoolPaymentCommand(body.ReservationId)));

    /// <summary>
    /// Iran Kish return: an anonymous form POST. Field lookup is case-insensitive, success is only
    /// recorded after server-side verification, and the answer is a 302 back to the dashboard.
    /// </summary>
    public static async Task<RedirectHttpResult> WalfareIrkReturn(ISender sender, HttpRequest request)
    {
        var form = request.HasFormContentType ? await request.ReadFormAsync() : null;
        string? F(string name) => form?[name].FirstOrDefault();

        var url = await sender.Send(new HandleIrkCallbackCommand(
            F("responseCode"),
            F("token"),
            F("paymentId"),
            F("retrievalReferenceNumber"),
            F("systemTraceAuditNumber"),
            F("maskedPan"),
            F("amount")));

        return TypedResults.Redirect(url);
    }

    public static async Task<Ok<WalfarePagedResult<PaymentTransactionDto>>> GetWalfarePaymentsAdmin(
        ISender sender, PaymentStatus? status = null, string? q = null, int page = 1, int pageSize = 20)
        => TypedResults.Ok(await sender.Send(new GetPaymentsAdminQuery(status, q, page, pageSize)));

    /// <summary>Admin manual verify for a payment the automatic callback left unverified.</summary>
    public static async Task<Ok<PaymentTransactionDto>> ConfirmWalfarePayment(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new ConfirmPaymentCommand(id)));
}
