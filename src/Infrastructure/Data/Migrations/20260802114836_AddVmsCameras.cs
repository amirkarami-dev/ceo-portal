using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddVmsCameras : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VmsCities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VmsCities", x => x.Id);
                    table.UniqueConstraint("AK_VmsCities_Code", x => x.Code);
                });

            migrationBuilder.CreateTable(
                name: "VmsCameras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CityCode = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Host = table.Column<string>(type: "nvarchar(253)", maxLength: 253, nullable: false),
                    RtspPort = table.Column<int>(type: "int", nullable: false),
                    StreamKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CredentialKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Channel = table.Column<int>(type: "int", nullable: false),
                    SubStreamId = table.Column<int>(type: "int", nullable: false),
                    MainStreamId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    LastSeenUtc = table.Column<DateTimeOffset>(type: "datetimeoffset(0)", precision: 0, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VmsCameras", x => x.Id);
                    table.CheckConstraint("CK_VmsCameras_Channel", "[Channel] >= 1");
                    table.CheckConstraint("CK_VmsCameras_MainStreamId", "[MainStreamId] IS NULL OR [MainStreamId] >= 1");
                    table.CheckConstraint("CK_VmsCameras_RtspPort", "[RtspPort] BETWEEN 1 AND 65535");
                    table.CheckConstraint("CK_VmsCameras_StreamsDiffer", "[MainStreamId] IS NULL OR [MainStreamId] <> [SubStreamId]");
                    table.CheckConstraint("CK_VmsCameras_SubStreamId", "[SubStreamId] >= 1");
                    table.ForeignKey(
                        name: "FK_VmsCameras_VmsCities_CityCode",
                        column: x => x.CityCode,
                        principalTable: "VmsCities",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VmsCameras_CityCode",
                table: "VmsCameras",
                column: "CityCode");

            migrationBuilder.CreateIndex(
                name: "IX_VmsCameras_IsDeleted_IsActive_CityCode",
                table: "VmsCameras",
                columns: new[] { "IsDeleted", "IsActive", "CityCode" });

            migrationBuilder.CreateIndex(
                name: "IX_VmsCameras_StreamKey",
                table: "VmsCameras",
                column: "StreamKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VmsCameras");

            migrationBuilder.DropTable(
                name: "VmsCities");
        }
    }
}
