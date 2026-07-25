// Sample Minimal-API endpoint group — copy to src/Web/Endpoints/<Group>.cs and replace placeholders.
//
// Replace:
//   <RootName>  — .NET namespace root (e.g. MyApp)
//   <Group>     — PascalCase resource AND route segment (e.g. Projects -> /api/Projects)
//   <Entity>    — the entity/DTO base name (e.g. Project)
//
// Conventions:
//   - A class implementing IEndpointGroup is auto-mapped at /api/{ClassName} by
//     app.MapEndpoints(typeof(Program).Assembly) — NO manual registration needed.
//   - Handlers are STATIC, inject services as parameters, bind the body from the last complex
//     parameter, and return TypedResults / Results<T1,T2> (not IResult).
//   - MapGet/MapPost take an OPTIONAL route pattern; MapPut/MapPatch/MapDelete REQUIRE one
//     (usually "{id}"). The handler method name becomes the OpenAPI operationId.
//   - Gate with RequireAuthorization(); for admin-only use
//     RequireAuthorization(p => p.RequireRole(Roles.Administrator)) (Roles in Domain/Constants).
//   - 404/403/400 thrown from handlers (Guard.Against.NotFound, ForbiddenAccessException,
//     validation failures) are converted to ProblemDetails by ProblemDetailsExceptionHandler,
//     so only branch on outcomes you choose to model (e.g. Results<Ok<T>, NotFound>).
using <RootName>.Application.<Group>;
using <RootName>.Application.<Group>.Commands.Create<Entity>;
using <RootName>.Application.<Group>.Commands.Delete<Entity>;
using <RootName>.Application.<Group>.Commands.Update<Entity>;
using <RootName>.Application.<Group>.Queries.Get<Entity>;
using <RootName>.Application.<Group>.Queries.Get<Group>;
using Microsoft.AspNetCore.Http.HttpResults;

namespace <RootName>.Web.Endpoints;

public class <Group> : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();            // whole group needs a bearer token

        groupBuilder.MapGet(Get<Group>);                // GET    /api/<Group>
        groupBuilder.MapGet(Get<Entity>, "{id}");       // GET    /api/<Group>/{id}
        groupBuilder.MapPost(Create<Entity>);           // POST   /api/<Group>
        groupBuilder.MapPut(Update<Entity>, "{id}");    // PUT    /api/<Group>/{id}
        groupBuilder.MapDelete(Delete<Entity>, "{id}"); // DELETE /api/<Group>/{id}
    }

    public static async Task<Ok<IReadOnlyList<<Entity>Dto>>> Get<Group>(ISender sender)
        => TypedResults.Ok(await sender.Send(new Get<Group>Query()));

    public static async Task<Ok<<Entity>Dto>> Get<Entity>(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new Get<Entity>ByIdQuery(id)));   // handler uses Guard.Against.NotFound

    public static async Task<Created<int>> Create<Entity>(ISender sender, Create<Entity>Command command)
    {
        var newId = await sender.Send(command);
        return TypedResults.Created($"/api/<Group>/{newId}", newId);
    }

    public static async Task<Results<NoContent, BadRequest>> Update<Entity>(
        ISender sender, int id, Update<Entity>Command command)
    {
        if (id != command.Id) return TypedResults.BadRequest();   // route/body id mismatch
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> Delete<Entity>(ISender sender, int id)
    {
        await sender.Send(new Delete<Entity>Command(id));
        return TypedResults.NoContent();
    }
}
