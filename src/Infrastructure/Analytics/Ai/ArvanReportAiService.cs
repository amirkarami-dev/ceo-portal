using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Analytics.Ai;

/// <summary>
/// Real ArvanCloud AI report-generation service.
/// Calls the ArvanCloud AI gateway (OpenAI-compatible chat-completions endpoint)
/// with a grounding system prompt derived from the requested semantic model,
/// then parses the reasoning-model response into a <see cref="ReportDefinitionDto"/>.
/// </summary>
internal sealed class ArvanReportAiService : IReportAiService
{
    // Static HttpClient (NOT the DI typed client) so the call bypasses Aspire's standard
    // resilience handler, whose 10s per-attempt timeout would abort the ~20s reasoning-model call.
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(120) };
    private readonly ArvanAiOptions _options;
    private readonly ISemanticModelStore _modelStore;
    private readonly ILogger<ArvanReportAiService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public ArvanReportAiService(
        IOptions<ArvanAiOptions> options,
        ISemanticModelStore modelStore,
        ILogger<ArvanReportAiService> logger)
    {
        _options = options.Value;
        _modelStore = modelStore;
        _logger = logger;
    }

    // ------------------------------------------------------------------
    // Pure helpers (also exercised by unit tests)
    // ------------------------------------------------------------------

    /// <summary>
    /// Strips the reasoning block produced by a thinking model and extracts
    /// the JSON object from the remaining content.
    /// </summary>
    /// <param name="content">Raw content from <c>choices[0].message.content</c>.</param>
    /// <returns>Trimmed JSON string ready for deserialization.</returns>
    internal static string ExtractJson(string content)
    {
        // Remove the <think>…</think> block (if present).
        var afterThink = content;
        var closeTag = content.LastIndexOf("</think>", StringComparison.OrdinalIgnoreCase);
        if (closeTag >= 0)
            afterThink = content[(closeTag + "</think>".Length)..];

        // Strip optional markdown code-fences (```json … ``` or ``` … ```).
        var trimmed = afterThink.Trim();
        if (trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            var firstNewline = trimmed.IndexOf('\n');
            if (firstNewline >= 0)
                trimmed = trimmed[(firstNewline + 1)..];
            if (trimmed.EndsWith("```", StringComparison.Ordinal))
                trimmed = trimmed[..^3];
            trimmed = trimmed.Trim();
        }

        // Extract the outermost JSON object.
        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start < 0 || end < 0 || end <= start)
            return trimmed; // let the caller fail with a meaningful deserialization error

        return trimmed[start..(end + 1)];
    }

    /// <summary>
    /// Builds the system prompt that grounds the AI in the given semantic model.
    /// </summary>
    internal static string BuildSystemPrompt(SemanticModelDto model)
    {
        var sb = new StringBuilder();
        sb.AppendLine("You are a report-definition generator. Convert the user's natural-language request into EXACTLY ONE JSON object matching the ReportDefinition schema below.");
        sb.AppendLine();
        sb.AppendLine("ReportDefinition schema (all keys camelCase):");
        sb.AppendLine("  id          string   — a short snake_case identifier you invent");
        sb.AppendLine("  name        string   — human-readable report title");
        sb.AppendLine($"  dataset     string   — MUST be exactly \"{model.Source}\"");
        sb.AppendLine("  columns     array    — [{ field: string }]  (dimension fields to show)");
        sb.AppendLine("  filters     array    — [{ field, operator, value }]");
        sb.AppendLine("               operators: eq | neq | gt | gte | lt | lte | in | contains | between");
        sb.AppendLine("  groupBy     array    — [{ field, dateBucket? }]");
        sb.AppendLine("               dateBucket values: day | week | month | quarter | year");
        sb.AppendLine("  metrics     array    — [{ field, aggregation, alias? }]");
        sb.AppendLine("               aggregations: sum | avg | min | max | count | countDistinct");
        sb.AppendLine("  sorting     array    — [{ field, direction }]  direction: asc | desc");
        sb.AppendLine("  limit       integer? — optional row cap");
        sb.AppendLine();
        sb.AppendLine("Rules:");
        sb.AppendLine("  • ONLY use field ids listed in the model below — never invent field names.");
        sb.AppendLine($"  • dataset MUST always be \"{model.Source}\".");
        sb.AppendLine("  • NEVER output SQL, MDX, DAX, or any query language.");
        sb.AppendLine("  • Output ONLY the JSON object — no prose, no markdown, no explanation outside the JSON.");
        sb.AppendLine("  • Reason inside <think>…</think> first, then output the JSON after closing the tag.");
        sb.AppendLine();
        sb.AppendLine($"Available fields for model \"{model.ModelKey}\" (source: \"{model.Source}\"):");

        foreach (var f in model.Fields)
        {
            // The description carries the field's Persian meaning AND its code dictionary
            // (e.g. Reshte: 1=معماری …), so "مهندسین برق" becomes `Reshte eq 5`, not a guess.
            sb.AppendLine(string.IsNullOrWhiteSpace(f.Description)
                ? $"  {f.Id}({f.Type},{f.Role})"
                : $"  {f.Id}({f.Type},{f.Role}) — {f.Description}");
        }

        return sb.ToString().TrimEnd();
    }

    // ------------------------------------------------------------------
    // IReportAiService
    // ------------------------------------------------------------------

    public async Task<ReportDefinitionDto> GenerateAsync(
        string prompt,
        string semanticModelId,
        CancellationToken cancellationToken = default)
    {
        // 1. Resolve semantic model.
        var model = await _modelStore.GetByIdAsync(semanticModelId, cancellationToken);
        if (model is null)
            throw new KeyNotFoundException($"Semantic model '{semanticModelId}' not found.");

        // 2. Build messages.
        var systemPrompt = BuildSystemPrompt(model);
        var messages = new[]
        {
            new { role = "system", content = systemPrompt },
            new { role = "user",   content = prompt },
        };

        // 3. Build request body.
        var body = new
        {
            model = _options.Model,
            messages,
            max_tokens = 2000,
            temperature = 0.2,
        };

        // 4. POST to the gateway, setting the apikey auth header per-request.
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_options.BaseUrl.TrimEnd('/')}/chat/completions")
        {
            Content = JsonContent.Create(body),
        };
        request.Headers.TryAddWithoutValidation("Authorization", $"apikey {_options.ApiKey}");

        _logger.LogInformation(
            "ArvanReportAiService: posting to AI gateway for model '{ModelId}'", semanticModelId);

        using var response = await Http.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new InvalidOperationException(
                $"AI gateway returned {(int)response.StatusCode} {response.ReasonPhrase}: {errorBody}");
        }

        // 5. Parse OpenAI-shaped response.
        using var responseDoc = await response.Content.ReadFromJsonAsync<JsonDocument>(
            JsonOptions, cancellationToken)
            ?? throw new InvalidOperationException("AI gateway returned empty response.");

        var content = responseDoc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString()
            ?? throw new InvalidOperationException("AI gateway response missing choices[0].message.content.");

        _logger.LogDebug("ArvanReportAiService raw content: {Content}", content);

        // 6. Strip <think> block and extract JSON.
        var json = ExtractJson(content);

        ReportDefinitionDto? dto;
        try
        {
            dto = JsonSerializer.Deserialize<ReportDefinitionDto>(json, JsonOptions);
        }
        catch (JsonException ex)
        {
            _logger.LogDebug("ArvanReportAiService: failed to deserialize AI response. Raw content: {Content}", content);
            throw new InvalidOperationException(
                $"AI response could not be deserialized as ReportDefinitionDto: {ex.Message}", ex);
        }

        if (dto is null)
            throw new InvalidOperationException("AI response deserialized to null.");

        // 7. Force dataset to match the model source (guard against AI hallucination).
        if (!string.Equals(dto.Dataset, model.Source, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "AI returned dataset '{AiDataset}' but expected '{Expected}'; overriding.",
                dto.Dataset, model.Source);

            dto = new ReportDefinitionDto
            {
                Id = dto.Id,
                Name = dto.Name,
                Dataset = model.Source,
                Columns = dto.Columns,
                Filters = dto.Filters,
                GroupBy = dto.GroupBy,
                Metrics = dto.Metrics,
                Sorting = dto.Sorting,
                Limit = dto.Limit,
            };
        }

        return dto;
    }
}
