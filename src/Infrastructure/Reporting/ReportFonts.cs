using QuestPDF.Drawing;

namespace Mabhas19.Infrastructure.Reporting;

/// <summary>
/// Registers a Persian-capable font for PDF generation. Place a TTF at
/// <c>{ContentRoot}/Fonts/Vazirmatn-Regular.ttf</c> (and -Bold) — the Docker image
/// installs Vazirmatn. Falls back to a generic family if not found.
/// </summary>
public static class ReportFonts
{
    public const string PersianFamily = "Vazirmatn";
    private static bool _registered;

    public static void Register(string contentRootPath)
    {
        if (_registered) return;

        var fontsDir = Path.Combine(contentRootPath, "Fonts");
        if (Directory.Exists(fontsDir))
        {
            foreach (var ttf in Directory.EnumerateFiles(fontsDir, "*.ttf"))
            {
                using var stream = File.OpenRead(ttf);
                FontManager.RegisterFont(stream);
            }
        }

        _registered = true;
    }
}
