using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKurdnezamContactSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "MapLabel",
                table: "KurdnezamSettings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MapUrl",
                table: "KurdnezamSettings",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "KurdnezamOrgPages",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ParentSlug",
                table: "KurdnezamOrgPages",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Summary",
                table: "KurdnezamOrgPages",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "SectionId",
                table: "KurdnezamContactMessages",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "KurdnezamContactSections",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Icon = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamContactSections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamContactChannels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SectionId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Value = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamContactChannels", x => x.Id);
                    table.CheckConstraint("CK_KurdnezamContactChannels_Kind", "[Kind] IN ('phone', 'mobile', 'fax', 'email', 'address', 'postal', 'hours', 'telegram', 'instagram', 'website')");
                    table.ForeignKey(
                        name: "FK_KurdnezamContactChannels_KurdnezamContactSections_SectionId",
                        column: x => x.SectionId,
                        principalTable: "KurdnezamContactSections",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamOrgPages_ParentSlug_SortOrder",
                table: "KurdnezamOrgPages",
                columns: new[] { "ParentSlug", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamContactMessages_SectionId",
                table: "KurdnezamContactMessages",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamContactChannels_SectionId",
                table: "KurdnezamContactChannels",
                column: "SectionId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamContactSections_SortOrder",
                table: "KurdnezamContactSections",
                column: "SortOrder");

            migrationBuilder.AddForeignKey(
                name: "FK_KurdnezamContactMessages_KurdnezamContactSections_SectionId",
                table: "KurdnezamContactMessages",
                column: "SectionId",
                principalTable: "KurdnezamContactSections",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // The data backfill is deliberately NOT here — see the next migration,
            // BackfillKurdnezamContactContent, for why it cannot share this batch.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_KurdnezamContactMessages_KurdnezamContactSections_SectionId",
                table: "KurdnezamContactMessages");

            migrationBuilder.DropTable(
                name: "KurdnezamContactChannels");

            migrationBuilder.DropTable(
                name: "KurdnezamContactSections");

            migrationBuilder.DropIndex(
                name: "IX_KurdnezamOrgPages_ParentSlug_SortOrder",
                table: "KurdnezamOrgPages");

            migrationBuilder.DropIndex(
                name: "IX_KurdnezamContactMessages_SectionId",
                table: "KurdnezamContactMessages");

            migrationBuilder.DropColumn(
                name: "MapLabel",
                table: "KurdnezamSettings");

            migrationBuilder.DropColumn(
                name: "MapUrl",
                table: "KurdnezamSettings");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "KurdnezamOrgPages");

            migrationBuilder.DropColumn(
                name: "ParentSlug",
                table: "KurdnezamOrgPages");

            migrationBuilder.DropColumn(
                name: "Summary",
                table: "KurdnezamOrgPages");

            migrationBuilder.DropColumn(
                name: "SectionId",
                table: "KurdnezamContactMessages");
        }
    }
}
