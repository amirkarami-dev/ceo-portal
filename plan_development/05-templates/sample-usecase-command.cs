// Sample CQRS command + handler — copy to
//   src/Application/<Feature>/Commands/<Name>/<Name>.cs   and replace placeholders.
//
// Replace:
//   <RootName>  — .NET namespace root (e.g. MyApp)
//   <Feature>   — feature folder / endpoint group (e.g. Projects)
//   <Name>      — command name (e.g. CreateProject)
//   <Entity>    — the domain entity it creates (e.g. Project)
//
// Conventions:
//   - Command + handler live in ONE file. The request is a `record` implementing IRequest<T>
//     (use IRequest for void). Returning the new id is typical for a create.
//   - [Authorize] (Application/Common/Security) makes AuthorizationBehaviour require a signed-in
//     user; inject IUser for the caller. The MediatR pipeline (Logging -> UnhandledException ->
//     Authorization -> Validation -> Performance) runs around every handler automatically.
//   - Talk to the DB ONLY through IApplicationDbContext (provider-agnostic). Never reference an
//     EF provider type from Application.
//   - For 404 use Guard.Against.NotFound(id, entity); for 403 throw ForbiddenAccessException.
using <RootName>.Application.Common.Interfaces;
using <RootName>.Application.Common.Security;
using <RootName>.Domain.Entities;

namespace <RootName>.Application.<Feature>.Commands.<Name>;

[Authorize]
public record <Name>Command : IRequest<int>      // returns the new entity id
{
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public double SomeNumber { get; init; }
    public int SomeCount { get; init; }
}

public class <Name>CommandHandler : IRequestHandler<<Name>Command, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;                  // current signed-in user

    public <Name>CommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<int> Handle(<Name>Command request, CancellationToken cancellationToken)
    {
        var entity = new <Entity>
        {
            Title = request.Title,
            Description = request.Description,
            SomeNumber = request.SomeNumber,
            SomeCount = request.SomeCount,
            OwnerId = _user.Id!,
        };

        _context.<Entity>s.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}
