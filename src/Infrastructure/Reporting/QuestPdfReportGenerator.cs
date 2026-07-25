using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Reports;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Mabhas19.Infrastructure.Reporting;

/// <summary>
/// Generates the Section 19 assessment report as a Persian (RTL) PDF using QuestPDF.
/// A Persian-capable font is registered at startup (see <see cref="ReportFonts"/>).
/// </summary>
public class QuestPdfReportGenerator : IReportGenerator
{
    private static readonly string Font = ReportFonts.PersianFamily;

    public byte[] GenerateAssessmentReport(AssessmentReportModel model)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.ContentFromRightToLeft();
                page.DefaultTextStyle(x => x.FontFamily(Font).FontSize(11).FontColor(Colors.Grey.Darken3));

                page.Header().Column(col =>
                {
                    col.Item().Text("گزارش ارزیابی جامع انرژی ساختمان")
                        .FontSize(18).Bold().FontColor("#0f766e");
                    col.Item().Text("بر اساس مبحث ۱۹ مقررات ملی ساختمان — پیوست ۵، ویرایش پنجم")
                        .FontSize(10).FontColor(Colors.Grey.Medium);
                    col.Item().PaddingTop(6).LineHorizontal(1).LineColor("#0f766e");
                });

                page.Content().PaddingVertical(12).Column(col =>
                {
                    col.Spacing(14);

                    col.Item().Text("مشخصات پروژه").FontSize(14).Bold().FontColor("#0f766e");
                    col.Item().Element(c => MetaTable(c, model));

                    col.Item().PaddingTop(6).Text("نتایج ارزیابی به تفکیک بخش").FontSize(14).Bold().FontColor("#0f766e");
                    col.Item().Element(c => SectionsTable(c, model));

                    col.Item().Element(c => TotalBox(c, model));
                });

                page.Footer().AlignLeft().Text(txt =>
                {
                    txt.Span("تاریخ تولید گزارش: ");
                    txt.Span(model.GeneratedAt.ToString("yyyy-MM-dd HH:mm")).SemiBold();
                    txt.Span("  —  Mabhas19 • mabhas19.myceo.ir");
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void MetaTable(IContainer container, AssessmentReportModel m)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c => { c.RelativeColumn(); c.RelativeColumn(); });

            void Row(string label, string value)
            {
                table.Cell().Background(Colors.Grey.Lighten4).Padding(5).Text(label).SemiBold();
                table.Cell().Padding(5).Text(string.IsNullOrWhiteSpace(value) ? "—" : value);
            }

            Row("عنوان پروژه", m.ProjectTitle);
            Row("کارفرما", m.Client ?? "");
            Row("نشانی", m.Address ?? "");
            Row("شهر", m.City);
            Row("پهنه اقلیمی", $"{m.ClimateLabel} (کد {m.ClimateCode})");
            Row("مساحت کل (m²)", m.TotalArea.ToString("0.##"));
            Row("تعداد طبقات", m.FloorCount.ToString());
            Row("تعداد واحد", m.UnitCount.ToString());
            Row("کاربری", m.Usage ?? "");
            Row("گروه ساختمان", m.BuildingGroupLabel);
        });
    }

    private static void SectionsTable(IContainer container, AssessmentReportModel m)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(c =>
            {
                c.RelativeColumn(4);
                c.RelativeColumn(2);
                c.RelativeColumn(2);
                c.RelativeColumn(2);
            });

            table.Header(header =>
            {
                header.Cell().Background("#0f766e").Padding(5).Text("بخش").FontColor(Colors.White).SemiBold();
                header.Cell().Background("#0f766e").Padding(5).Text("امتیاز کسب‌شده").FontColor(Colors.White).SemiBold();
                header.Cell().Background("#0f766e").Padding(5).Text("حداکثر امتیاز").FontColor(Colors.White).SemiBold();
                header.Cell().Background("#0f766e").Padding(5).Text("وضعیت").FontColor(Colors.White).SemiBold();
            });

            foreach (var s in m.Sections)
            {
                var pass = s.MaxScore > 0 && s.Score >= s.MaxScore;
                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(s.Title);
                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(s.Score.ToString());
                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Text(s.MaxScore.ToString());
                table.Cell().BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5)
                    .Text(pass ? "قبول" : "نیازمند بهبود")
                    .FontColor(pass ? "#15803d" : "#b91c1c").SemiBold();
            }
        });
    }

    private static void TotalBox(IContainer container, AssessmentReportModel m)
    {
        var pct = m.MaxScore > 0 ? (double)m.TotalScore / m.MaxScore * 100 : 0;
        container.Background("#0f766e").Padding(12).Row(row =>
        {
            row.RelativeItem().Text($"امتیاز کل: {m.TotalScore} از {m.MaxScore}")
                .FontColor(Colors.White).FontSize(14).Bold();
            row.ConstantItem(120).AlignLeft().Text($"{pct:0.#}%")
                .FontColor(Colors.White).FontSize(14).Bold();
        });
    }
}
