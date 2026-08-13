namespace Mabhas19.Application.Analytics.SemanticModels;

/// <summary>Describes a single field/column in a semantic model.</summary>
public class SemanticFieldDto
{
    /// <summary>Field identifier (matches the AI-generated JSON field names).</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>
    /// Raw column key in the dataset rows. Defaults to <see cref="Id"/> when the
    /// column name matches the field id (most cases); set explicitly when they differ
    /// (e.g. id="area", column="areaM2"; id="quantity", column="qty").
    /// </summary>
    public string? Column { get; init; }

    /// <summary>Resolved column key: <see cref="Column"/> if set, otherwise <see cref="Id"/>.</summary>
    public string ResolvedColumn => Column ?? Id;

    /// <summary>Human-readable label (en-US).</summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>string | number | date</summary>
    public string Type { get; init; } = string.Empty;

    /// <summary>dimension | measure | date</summary>
    public string Role { get; init; } = string.Empty;

    /// <summary>
    /// Optional meaning of the field — most importantly its CODE dictionary (e.g.
    /// "پایه طراحی: 1=پایه یک, 2=پایه دو, 3=پایه سه, -1=ارشد, 0=ندارد"). Fed verbatim into the
    /// AI grounding prompt so natural-language filters map to the right raw values.
    /// </summary>
    public string? Description { get; init; }

    /// <summary>
    /// Optional code → display-label map, applied to RESULT rows only (filters and SQL keep the
    /// raw codes; the AI already targets codes via <see cref="Description"/>). Keys are the
    /// normalised code strings ("1", "-1", …); bit columns arrive as bool and normalise to
    /// "1"/"0". See SqlQueryEngine.ApplyValueLabels.
    /// </summary>
    public IReadOnlyDictionary<string, string>? ValueLabels { get; init; }

    /// <summary>
    /// Codes that mean the same thing and must count as ONE group. Key = the code to fold away,
    /// value = the code it folds into (e.g. TypProject "0" → "1", because the organisation uses
    /// two codes for عادی).
    /// <para>
    /// This exists because <see cref="ValueLabels"/> cannot do it: that map is applied to result
    /// rows AFTER the SQL has run, so it renames a value but leaves two separate groups — two rows
    /// both reading «عادی», with the count and the percentage split between them. Merging has to
    /// happen in the GROUP BY, which is what this drives.
    /// </para>
    /// <para>
    /// Comes from the TRUSTED semantic model, never from user input, and both sides are still
    /// validated as integers before they reach SQL.
    /// </para>
    /// </summary>
    public IReadOnlyDictionary<string, string>? EquivalentCodes { get; init; }

    /// <summary>
    /// Bucket code for values that are not in <see cref="ValueLabels"/> — and for NULL. Everything
    /// unexplained is folded into this ONE code in the GROUP BY, so a report shows a single «سایر»
    /// row instead of one bare number per code nobody has documented.
    /// <para>
    /// Give <see cref="ValueLabels"/> an entry for it, or the bucket shows as a raw number. Pick a
    /// value that cannot collide with a real code (e.g. "9999").
    /// </para>
    /// <para>
    /// Only applies to a dimension with a dictionary: without <see cref="ValueLabels"/> there is no
    /// list of known codes to be outside of, so it is ignored.
    /// </para>
    /// </summary>
    public string? OtherCode { get; init; }

    // ── Optional code → label lookup ─────────────────────────────────────────
    // When all three are set (from the TRUSTED semantic model, never user input),
    // GROUP BY on this field LEFT JOINs the lookup table and returns the human-readable
    // name instead of the raw code. Identifiers are bracket-quoted from these values.

    /// <summary>Lookup/reference table that maps this field's code to a label.</summary>
    public string? LookupTable { get; init; }

    /// <summary>Key column in the lookup table joined against this field's code.</summary>
    public string? LookupKeyColumn { get; init; }

    /// <summary>Name/label column in the lookup table returned in place of the code.</summary>
    public string? LookupNameColumn { get; init; }

    /// <summary>True when a complete code→label lookup is configured for this field.</summary>
    public bool HasLookup =>
        !string.IsNullOrEmpty(LookupTable) &&
        !string.IsNullOrEmpty(LookupKeyColumn) &&
        !string.IsNullOrEmpty(LookupNameColumn);
}

/// <summary>Summary of a queryable semantic model available to the report engine.</summary>
public class SemanticModelDto
{
    public string ModelKey { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    public string? Description { get; init; }

    /// <summary>
    /// The source key that must be used as the <c>dataset</c> value in
    /// the generated <see cref="Mabhas19.Application.Analytics.Reports.ReportDefinitionDto"/>.
    /// </summary>
    public string Source { get; init; } = string.Empty;

    /// <summary>
    /// Real table this model reads. Comes from the TRUSTED semantic model only — never from user
    /// input or from the AI — because the query engine bracket-quotes it straight into SQL.
    /// Empty means the model is not SQL-backed (the in-memory sample engine).
    /// </summary>
    public string Table { get; init; } = string.Empty;

    /// <summary>
    /// Which configured connection the table lives on: <c>AnalyticsDb</c> (the KurdNezam warehouse,
    /// the default) or <c>CeoDb</c> (this application's own database, where the welfare tables are).
    /// The two are different SQL Server instances, so a model must say which one it belongs to.
    /// </summary>
    public string ConnectionName { get; init; } = SemanticConnections.AnalyticsDb;

    /// <summary>
    /// True when this model exposes personal data and must be restricted to the
    /// <c>Administrator</c> role. The Reports endpoint itself only requires authentication, so
    /// without this flag any signed-in portal user could export کد ملی and names.
    /// Enforced in <c>ExecuteReportQueryHandler</c>, and the model is hidden from the dataset list
    /// for everyone else.
    /// </summary>
    public bool RequiresAdministrator { get; init; }

    /// <summary>All fields exposed by this model.</summary>
    public IReadOnlyList<SemanticFieldDto> Fields { get; init; } = [];
}

/// <summary>Names of the connections a semantic model may be bound to.</summary>
public static class SemanticConnections
{
    /// <summary>The external KurdNezam warehouse (<c>ConnectionStrings:AnalyticsDb</c>).</summary>
    public const string AnalyticsDb = "AnalyticsDb";

    /// <summary>This application's own database (<c>ConnectionStrings:CeoDb</c>).</summary>
    public const string CeoDb = "CeoDb";
}
