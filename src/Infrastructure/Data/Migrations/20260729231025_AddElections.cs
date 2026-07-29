using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddElections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ElectionBallots",
                columns: table => new
                {
                    BallotId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ElectionId = table.Column<int>(type: "int", nullable: false),
                    Sealed = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    KeyVersion = table.Column<byte>(type: "tinyint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectionBallots", x => x.BallotId);
                });

            migrationBuilder.CreateTable(
                name: "Elections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    EligibilityMode = table.Column<int>(type: "int", nullable: false),
                    DateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time(0)", precision: 0, nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time(0)", precision: 0, nullable: false),
                    OpensAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(0)", precision: 0, nullable: false),
                    ClosesAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(0)", precision: 0, nullable: false),
                    MaxSelections = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    TalliedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(0)", precision: 0, nullable: true),
                    ResultDigest = table.Column<byte[]>(type: "varbinary(32)", maxLength: 32, nullable: true),
                    KeyVersion = table.Column<byte>(type: "tinyint", nullable: false),
                    BallotsPurgedAt = table.Column<DateTimeOffset>(type: "datetimeoffset(0)", precision: 0, nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Elections", x => x.Id);
                    table.CheckConstraint("CK_Elections_MaxSelections", "[MaxSelections] >= 1");
                    table.CheckConstraint("CK_Elections_Window", "[ClosesAtUtc] > [OpensAtUtc]");
                });

            migrationBuilder.CreateTable(
                name: "ElectionVoteReceipts",
                columns: table => new
                {
                    ElectionId = table.Column<int>(type: "int", nullable: false),
                    VoterHash = table.Column<byte[]>(type: "binary(32)", fixedLength: true, maxLength: 32, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectionVoteReceipts", x => new { x.ElectionId, x.VoterHash });
                });

            migrationBuilder.CreateTable(
                name: "ElectionCandidates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ElectionId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReshteCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EducationLevel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectionCandidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ElectionCandidates_Elections_ElectionId",
                        column: x => x.ElectionId,
                        principalTable: "Elections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ElectionEligibleReshtes",
                columns: table => new
                {
                    ElectionId = table.Column<int>(type: "int", nullable: false),
                    ReshteCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ReshteLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ElectionEligibleReshtes", x => new { x.ElectionId, x.ReshteCode });
                    table.ForeignKey(
                        name: "FK_ElectionEligibleReshtes_Elections_ElectionId",
                        column: x => x.ElectionId,
                        principalTable: "Elections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ElectionBallots_ElectionId",
                table: "ElectionBallots",
                column: "ElectionId");

            migrationBuilder.CreateIndex(
                name: "IX_ElectionCandidates_ElectionId_SortOrder",
                table: "ElectionCandidates",
                columns: new[] { "ElectionId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Elections_Status_ClosesAtUtc",
                table: "Elections",
                columns: new[] { "Status", "ClosesAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ElectionBallots");

            migrationBuilder.DropTable(
                name: "ElectionCandidates");

            migrationBuilder.DropTable(
                name: "ElectionEligibleReshtes");

            migrationBuilder.DropTable(
                name: "ElectionVoteReceipts");

            migrationBuilder.DropTable(
                name: "Elections");
        }
    }
}
