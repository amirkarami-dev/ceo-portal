using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj;
using Microsoft.Extensions.Logging;
using Moq;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunSanandajSyncServiceTests
{
    private Mock<IMunSanandajSourceReader> _reader = null!;
    private Mock<IMunSanandajGatewayClient> _gateway = null!;
    private Mock<IMunSanandajPdfFetcher> _pdfFetcher = null!;
    private MunSanandajSyncService _sut = null!;

    private static readonly MunSourceRowDto Row = new("90038565090216074508", "90038565", "-", "418162");

    private static readonly MunEngineerInfoDto Engineer = new(
        Ozviat: "1499", ShomarehNezam: "22-10-01079", FName: "حمید", LName: "پارسا",
        TarikhSodur: "1404/04/04", TarikhTamdid: "1404/05/05", TarikhPayanEtebar: "1405/04/04",
        PesronTyp: "1", NationalId: "3732087395", Mob: "9133240295", PayehNezaratTemp: "3", Major: "1");

    [SetUp]
    public void SetUp()
    {
        _reader = new Mock<IMunSanandajSourceReader>();
        _gateway = new Mock<IMunSanandajGatewayClient>();
        _pdfFetcher = new Mock<IMunSanandajPdfFetcher>();
        _pdfFetcher.Setup(f => f.FetchAsBase64Async(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync("cGRmYnl0ZXM=");

        _sut = new MunSanandajSyncService(
            Mock.Of<IApplicationDbContext>(),
            _reader.Object,
            _gateway.Object,
            _pdfFetcher.Object,
            Mock.Of<ILogger<MunSanandajSyncService>>());
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_pdf_not_found_fails_without_calling_gateway()
    {
        _pdfFetcher.Setup(f => f.FetchAsBase64Async(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync((string?)null);

        var (status, _, _, _, error, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Failed);
        error.ShouldBe("pdf not found");
        _gateway.Verify(g => g.SaveEngineerReportAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _reader.Verify(r => r.MarkReportSentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_success_marks_report_sent_in_db()
    {
        _gateway.Setup(g => g.SaveEngineerReportAsync(Row.ProjectNo, Row.ReqId, "cGRmYnl0ZXM=", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(true, "2583267", "{}", null, null));

        var (status, _, remoteId, _, _, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Success);
        remoteId.ShouldBe("2583267");
        // WebS_AddSabtNoToReport(@Rahgiri = Peygiri from sp1, @Sabt = submission id from saveEngineerReport).
        _reader.Verify(r => r.MarkReportSentAsync(Row.Peygiri, "2583267", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_send_failed_does_not_mark_sent()
    {
        _gateway.Setup(g => g.SaveEngineerReportAsync(Row.ProjectNo, Row.ReqId, "cGRmYnl0ZXM=", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(false, null, "{}", "city error", null));

        var (status, _, _, _, error, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Failed);
        error.ShouldBe("city error");
        _reader.Verify(r => r.MarkReportSentAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Test]
    public async Task ProcessSaveEngineerReportRowAsync_mark_sent_failure_still_returns_success()
    {
        // The report WAS sent to the city; a write-back (dedup) failure must not fail the row,
        // otherwise the next run would submit a duplicate.
        _gateway.Setup(g => g.SaveEngineerReportAsync(Row.ProjectNo, Row.ReqId, "cGRmYnl0ZXM=", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(true, "2583267", "{}", null, null));
        _reader.Setup(r => r.MarkReportSentAsync(Row.Peygiri, "2583267", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("db write failed"));

        var (status, _, remoteId, _, _, _) = await _sut.ProcessSaveEngineerReportRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Success);
        remoteId.ShouldBe("2583267");
    }

    [Test]
    public async Task ProcessSaveEngMapRowAsync_engineer_not_found_creates_then_retries_and_succeeds()
    {
        _reader.Setup(r => r.GetEngineersAsync(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MunEngineerInfoDto> { Engineer });

        _gateway.SetupSequence(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(false, null, "{}", "one or more engineers not found",
                new Dictionary<string, string> { ["3732087395"] = "مهندس یافت نشد..." }))
            .ReturnsAsync(new MunGatewayResult(true, "2581618", "{}", null, null));

        _gateway.Setup(g => g.AddEngineerAsync(Engineer, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunAddEngineerResult(true, null));

        var (status, _, remoteId, _, _, createdCodes) = await _sut.ProcessSaveEngMapRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Success);
        remoteId.ShouldBe("2581618");
        createdCodes.ShouldBe("3732087395");
        _gateway.Verify(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        _gateway.Verify(g => g.AddEngineerAsync(Engineer, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Test]
    public async Task ProcessSaveEngMapRowAsync_top_level_error_fails_without_addEngineer()
    {
        _reader.Setup(r => r.GetEngineersAsync(Row.Peygiri, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<MunEngineerInfoDto> { Engineer });

        _gateway.Setup(g => g.SaveEngMapAsync(Row.ProjectNo, It.IsAny<IReadOnlyList<MunEngMapEngineer>>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new MunGatewayResult(false, null, "{}", "Call to a member function toArray() on null", null));

        var (status, _, _, _, error, _) = await _sut.ProcessSaveEngMapRowAsync(Row, 1, CancellationToken.None);

        status.ShouldBe(Mabhas19.Domain.MunSanandaj.MunLogStatus.Failed);
        error.ShouldBe("Call to a member function toArray() on null");
        _gateway.Verify(g => g.AddEngineerAsync(It.IsAny<MunEngineerInfoDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
