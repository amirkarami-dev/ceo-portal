using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddWalfare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PaymentTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Gateway = table.Column<int>(type: "int", nullable: false),
                    AmountRials = table.Column<long>(type: "bigint", nullable: false),
                    PaymentId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Token = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<int>(type: "int", nullable: false),
                    TargetType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PayerName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    PayerNationalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ResponseCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    RetrievalReferenceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SystemTraceAuditNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    MaskedPan = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    VerifiedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentTransactions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WelfareServices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Type = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    StartDateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    EndDateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ActivationDateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: false),
                    ActivationDate = table.Column<DateOnly>(type: "date", nullable: false),
                    IsAccessible = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WelfareServices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WelfarePools",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ServiceId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    ActiveDays = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    PriceRials = table.Column<long>(type: "bigint", nullable: false),
                    ReserveStartTime = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    ReserveEndTime = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WelfarePools", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WelfarePools_WelfareServices_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "WelfareServices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WelfarePoolReservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PoolId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    NationalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReshteCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AmountRials = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    PaymentTransactionId = table.Column<int>(type: "int", nullable: true),
                    TrackingCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WelfarePoolReservations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WelfarePoolReservations_PaymentTransactions_PaymentTransactionId",
                        column: x => x.PaymentTransactionId,
                        principalTable: "PaymentTransactions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_WelfarePoolReservations_WelfarePools_PoolId",
                        column: x => x.PoolId,
                        principalTable: "WelfarePools",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_PaymentId",
                table: "PaymentTransactions",
                column: "PaymentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_Status",
                table: "PaymentTransactions",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_TargetType_TargetId",
                table: "PaymentTransactions",
                columns: new[] { "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_UserId",
                table: "PaymentTransactions",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WelfarePoolReservations_PaymentTransactionId",
                table: "WelfarePoolReservations",
                column: "PaymentTransactionId");

            migrationBuilder.CreateIndex(
                name: "IX_WelfarePoolReservations_PoolId_Date",
                table: "WelfarePoolReservations",
                columns: new[] { "PoolId", "Date" });

            migrationBuilder.CreateIndex(
                name: "IX_WelfarePoolReservations_UserId",
                table: "WelfarePoolReservations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_WelfarePools_ServiceId_IsActive",
                table: "WelfarePools",
                columns: new[] { "ServiceId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_WelfareServices_IsAccessible",
                table: "WelfareServices",
                column: "IsAccessible");

            migrationBuilder.CreateIndex(
                name: "IX_WelfareServices_Type",
                table: "WelfareServices",
                column: "Type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "WelfarePoolReservations");

            migrationBuilder.DropTable(
                name: "PaymentTransactions");

            migrationBuilder.DropTable(
                name: "WelfarePools");

            migrationBuilder.DropTable(
                name: "WelfareServices");
        }
    }
}
