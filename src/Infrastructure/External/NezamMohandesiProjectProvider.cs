using System.Net.Http.Headers;
using System.Net.Http.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Projects;
using Mabhas19.Domain.Enums;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.External;

/// <summary>
/// Imports projects from the Building Engineering System Organization (نظام مهندسی ساختمان).
/// Configure ExternalImport:NezamMohandesi:BaseUrl + ApiKey to hit the real service.
/// Without configuration (and AllowMock=true) it returns deterministic sample data so the
/// import flow can be exercised end-to-end.
/// </summary>
public class NezamMohandesiProjectProvider : IExternalProjectProvider
{
    private readonly HttpClient _http;
    private readonly NezamMohandesiOptions _options;
    private readonly ILogger<NezamMohandesiProjectProvider> _logger;

    public NezamMohandesiProjectProvider(
        HttpClient http,
        IOptions<NezamMohandesiOptions> options,
        ILogger<NezamMohandesiProjectProvider> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public ProjectSource Source => ProjectSource.NezamMohandesi;

    public async Task<ExternalProjectDto?> FetchAsync(string externalId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.BaseUrl))
        {
            if (!_options.AllowMock) return null;
            return Mock(externalId);
        }

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.BaseUrl!.TrimEnd('/')}/projects/{externalId}");
            if (!string.IsNullOrWhiteSpace(_options.ApiKey))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
            }

            var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("NezamMohandesi import failed ({Status}) for {Id}", response.StatusCode, externalId);
                return null;
            }

            return await response.Content.ReadFromJsonAsync<ExternalProjectDto>(cancellationToken: ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "NezamMohandesi import error for {Id}", externalId);
            return null;
        }
    }

    private static ExternalProjectDto Mock(string externalId) => new()
    {
        Title = $"پروژه نظام مهندسی #{externalId}",
        Client = "کارفرمای نمونه",
        Address = "تهران، خیابان نمونه",
        City = "تهران",
        ClimateCode = "3B",
        TotalArea = 1200,
        FloorCount = 5,
        UnitCount = 10,
        Usage = "مسکونی",
        Deed = externalId,
        Parcel = "12/3456",
        SystemId = externalId
    };
}
