using Mabhas19.Application.Projects;
using Mabhas19.Domain.Enums;

namespace Mabhas19.Application.Common.Interfaces;

/// <summary>
/// Imports project data from an external service (e.g. نظام مهندسی ساختمان —
/// the Building Engineering System Organization).
/// </summary>
public interface IExternalProjectProvider
{
    ProjectSource Source { get; }

    Task<ExternalProjectDto?> FetchAsync(string externalId, CancellationToken ct = default);
}
