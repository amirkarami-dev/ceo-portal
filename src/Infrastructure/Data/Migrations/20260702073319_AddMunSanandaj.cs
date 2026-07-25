using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMunSanandaj : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "mun_report_logs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RunId = table.Column<int>(type: "int", nullable: false),
                    WorkerType = table.Column<int>(type: "int", nullable: false),
                    Peygiri = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ProjectNo = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ReqId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Nosazi = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    AttemptNumber = table.Column<int>(type: "int", nullable: false),
                    RemoteSubmissionId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ResponseBody = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ErrorMessage = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedEngineerCodes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mun_report_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "mun_sync_runs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WorkerType = table.Column<int>(type: "int", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CompletedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    TotalRows = table.Column<int>(type: "int", nullable: false),
                    SuccessCount = table.Column<int>(type: "int", nullable: false),
                    FailedCount = table.Column<int>(type: "int", nullable: false),
                    TriggeredBy = table.Column<int>(type: "int", nullable: false),
                    TriggeredByUser = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mun_sync_runs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mun_report_logs_RunId",
                table: "mun_report_logs",
                column: "RunId");

            migrationBuilder.CreateIndex(
                name: "IX_mun_report_logs_WorkerType_Peygiri_Id",
                table: "mun_report_logs",
                columns: new[] { "WorkerType", "Peygiri", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_mun_sync_runs_RunId",
                table: "mun_sync_runs",
                column: "RunId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_mun_sync_runs_StartedAt",
                table: "mun_sync_runs",
                column: "StartedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mun_report_logs");

            migrationBuilder.DropTable(
                name: "mun_sync_runs");
        }
    }
}
