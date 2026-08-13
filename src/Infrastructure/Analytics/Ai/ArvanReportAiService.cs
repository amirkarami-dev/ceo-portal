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
        sb.AppendLine("               between takes TWO bounds: \"value\": [from, to]");
        sb.AppendLine("               in takes a list:            \"value\": [1, 2, 3]");
        sb.AppendLine("  groupBy     array    — [{ field, dateBucket? }]");
        sb.AppendLine("               dateBucket values: day | week | month | quarter | year");
        sb.AppendLine("  metrics     array    — [{ field, aggregation, alias? }]");
        sb.AppendLine("               aggregations: sum | avg | min | max | count | countDistinct | percentOfTotal");
        sb.AppendLine("               percentOfTotal = this row's share of the whole result, in percent.");
        sb.AppendLine("               Use it whenever the request says «درصد» or «percent», ALONGSIDE count");
        sb.AppendLine("               (or sum) — the reader wants the number and the share together.");
        sb.AppendLine("               field \"*\" counts rows; a measure field gives a share of that measure.");
        sb.AppendLine("  sorting     array    — [{ field, direction }]  direction: asc | desc");
        sb.AppendLine("  limit       integer? — optional row cap");
        sb.AppendLine();
        sb.AppendLine("Rules:");
        sb.AppendLine("  • ONLY use field ids listed in the model below — never invent field names.");
        sb.AppendLine($"  • dataset MUST always be \"{model.Source}\".");
        sb.AppendLine("  • NEVER output SQL, MDX, DAX, or any query language.");
        sb.AppendLine("  • Output ONLY the JSON object — no prose, no markdown, no explanation outside the JSON.");
        sb.AppendLine("  • Reason inside <think>…</think> first, then output the JSON after closing the tag.");
        sb.AppendLine("  • Keep the reasoning SHORT. The JSON is the answer; a long think can use up the");
        sb.AppendLine("    budget and leave no room for it.");
        sb.AppendLine("  • A Jalali date field is TEXT shaped 1405/03/17, so a whole year is a between over");
        sb.AppendLine("    its first and last day — never a bare number like 1405.");
        sb.AppendLine("    End the range on the 29th of Esfand (1405/12/29). Esfand has a 30th only in a leap");
        sb.AppendLine("    year, and a date that does not exist cannot be shown in a calendar.");
        sb.AppendLine();
        sb.AppendLine("Worked example — «تعداد و درصد پروژه‌ها به تفکیک نوع در سال ۱۴۰۵» becomes:");
        sb.AppendLine("  filters: [{ \"field\": \"<the date field>\", \"operator\": \"between\",");
        sb.AppendLine("             \"value\": [\"1405/01/01\", \"1405/12/29\"] }]");
        sb.AppendLine("  groupBy: [{ \"field\": \"<the type field>\" }]");
        sb.AppendLine("  metrics: [{ \"field\": \"*\", \"aggregation\": \"count\",          \"alias\": \"cnt\" },");
        sb.AppendLine("            { \"field\": \"*\", \"aggregation\": \"percentOfTotal\", \"alias\": \"pct\" }]");
        sb.AppendLine("  Codes that share a meaning are merged for you — do not write a CASE or a formula.");
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
            // A reasoning model spends tokens thinking BEFORE it writes any content, and the two
            // share this budget. Measured on DeepSeek-V4-Flash: ~1000 tokens of reasoning plus
            // ~500 of JSON. At 2000 a long think left nothing for the answer — one run in three
            // came back finish_reason "length" with content null, i.e. a failed report for the
            // user. 4000 leaves room for the think to run long and still produce the JSON.
            max_tokens = 4000,
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

        var choice = responseDoc.RootElement.GetProperty("choices")[0];
        var finishReason = choice.TryGetProperty("finish_reason", out var fr) ? fr.GetString() : null;

        var content = choice
            .GetProperty("message")
            .GetProperty("content")
            .GetString()
            // A reasoning model returns content null when it used the whole token budget thinking.
            // Say which of the two it was — "missing content" sends you looking for a parse bug
            // when the real answer is that the model never got to the answer.
            ?? throw new InvalidOperationException(
                string.Equals(finishReason, "length", StringComparison.OrdinalIgnoreCase)
                    ? "AI gateway stopped at the token limit while still reasoning, so it returned no answer. Raise max_tokens or shorten the prompt."
                    : $"AI gateway response missing choices[0].message.content (finish_reason: {finishReason ?? "none"}).");

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
