using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWalfareGuesthouse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "WelfareGuesthouses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ManagerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WelfareGuesthouses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WelfareGuesthouses_WelfareServices_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "WelfareServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GuesthouseRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GuesthouseId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedByAdmin = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NationalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MembershipNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Gender = table.Column<int>(type: "int", nullable: true),
                    CheckInDateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CheckOutDateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CheckInDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CheckOutDate = table.Column<DateOnly>(type: "date", nullable: false),
                    AmountRials = table.Column<long>(type: "bigint", nullable: false),
                    AdminNote = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    PaymentToken = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    PaymentTokenExpiresUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    PaymentTransactionId = table.Column<int>(type: "int", nullable: true),
                    PaidAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    ReceiptNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuesthouseRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuesthouseRequests_WelfareGuesthouses_GuesthouseId",
                        column: x => x.GuesthouseId,
                        principalTable: "WelfareGuesthouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "GuesthouseCompanions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Relation = table.Column<int>(type: "int", nullable: true),
                    IsInfant = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuesthouseCompanions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GuesthouseCompanions_GuesthouseRequests_RequestId",
                        column: x => x.RequestId,
                        principalTable: "GuesthouseRequests",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GuesthouseCompanions_RequestId",
                table: "GuesthouseCompanions",
                column: "RequestId");

            migrationBuilder.CreateIndex(
                name: "IX_GuesthouseRequests_GuesthouseId",
                table: "GuesthouseRequests",
                column: "GuesthouseId");

            migrationBuilder.CreateIndex(
                name: "IX_GuesthouseRequests_PaymentToken",
                table: "GuesthouseRequests",
                column: "PaymentToken",
                unique: true,
                filter: "[PaymentToken] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GuesthouseRequests_Status_CheckInDate",
                table: "GuesthouseRequests",
                columns: new[] { "Status", "CheckInDate" });

            migrationBuilder.CreateIndex(
                name: "IX_GuesthouseRequests_UserId",
                table: "GuesthouseRequests",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WelfareGuesthouses_ServiceId",
                table: "WelfareGuesthouses",
                column: "ServiceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GuesthouseCompanions");

            migrationBuilder.DropTable(
                name: "GuesthouseRequests");

            migrationBuilder.DropTable(
                name: "WelfareGuesthouses");
        }
    }
}
