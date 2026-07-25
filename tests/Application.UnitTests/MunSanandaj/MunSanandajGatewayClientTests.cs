using Mabhas19.Infrastructure.MunSanandaj;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.MunSanandaj;

[TestFixture]
public class MunSanandajGatewayClientTests
{
    [Test]
    public void ParseSaveEngineerReportResponse_success()
    {
        const string raw = """
            {"supervising_engineers_report": {"success": true, "peigiri": 2583267}}
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngineerReportResponse(raw);

        result.Success.ShouldBeTrue();
        result.RemoteSubmissionId.ShouldBe("2583267");
        result.ErrorMessage.ShouldBeNull();
    }

    [Test]
    public void ParseSaveEngineerReportResponse_non_json_is_failed_with_raw_in_error()
    {
        const string raw = "<html><body>500 Internal Server Error</body></html>";

        var result = MunSanandajGatewayClient.ParseSaveEngineerReportResponse(raw);

        result.Success.ShouldBeFalse();
        result.RawResponse.ShouldBe(raw);
        result.ErrorMessage.ShouldNotBeNull();
        result.ErrorMessage!.ShouldContain("non-JSON");
    }

    [Test]
    public void ParseSaveEngMapResponse_top_level_error_is_failed_with_no_engineer_retry()
    {
        const string raw = """
            {"error": "Call to a member function toArray() on null"}
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeFalse();
        result.ErrorMessage.ShouldBe("Call to a member function toArray() on null");
        result.FailedEngineerMessages.ShouldBeNull();
    }

    [Test]
    public void ParseSaveEngMapResponse_engineer_not_found_surfaces_for_addEngineer_retry()
    {
        const string raw = """
            {
                "engineers": {
                    "3732087395": { "success": false, "msg": "مهندس یافت نشد..." }
                },
                "files": { "building": { "success": true, "peigiri": 2581618 } }
            }
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeFalse();
        result.FailedEngineerMessages.ShouldNotBeNull();
        result.FailedEngineerMessages!.ShouldContainKeyAndValue("3732087395", "مهندس یافت نشد...");
    }

    [Test]
    public void ParseSaveEngMapResponse_success_reads_building_peigiri()
    {
        const string raw = """
            {
                "engineers": { "3732087395": { "success": true } },
                "files": { "building": { "success": true, "peigiri": 2581618 } }
            }
            """;

        var result = MunSanandajGatewayClient.ParseSaveEngMapResponse(raw);

        result.Success.ShouldBeTrue();
        result.RemoteSubmissionId.ShouldBe("2581618");
        result.FailedEngineerMessages.ShouldBeNull();
    }

    [Test]
    public void ParseAddEngineerResponse_success()
    {
        const string raw = """{"4420716746": {"success": true}}""";

        var result = MunSanandajGatewayClient.ParseAddEngineerResponse(raw);

        result.Success.ShouldBeTrue();
        result.ErrorMessage.ShouldBeNull();
    }

    [Test]
    public void ParseAddEngineerResponse_failure()
    {
        const string raw = """{"success": false, "msg": "invalid national_code (index 0)"}""";

        var result = MunSanandajGatewayClient.ParseAddEngineerResponse(raw);

        result.Success.ShouldBeFalse();
        result.ErrorMessage.ShouldBe("invalid national_code (index 0)");
    }
}
