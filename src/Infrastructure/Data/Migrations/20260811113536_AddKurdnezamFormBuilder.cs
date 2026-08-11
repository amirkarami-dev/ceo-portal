using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKurdnezamFormBuilder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FormId",
                table: "KurdnezamNews",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuccessMessage",
                table: "KurdnezamForms",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "KurdnezamFormAnswers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubmissionId = table.Column<int>(type: "int", nullable: false),
                    FieldId = table.Column<int>(type: "int", nullable: false),
                    FieldLabel = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamFormAnswers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamFormAnswers_KurdnezamFormSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "KurdnezamFormSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamFormAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubmissionId = table.Column<int>(type: "int", nullable: false),
                    FieldId = table.Column<int>(type: "int", nullable: false),
                    FieldLabel = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    StoredKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamFormAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamFormAttachments_KurdnezamFormSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "KurdnezamFormSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamFormFields",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormId = table.Column<int>(type: "int", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsRequired = table.Column<bool>(type: "bit", nullable: false),
                    AllowMultiple = table.Column<bool>(type: "bit", nullable: false),
                    MaxLength = table.Column<int>(type: "int", nullable: true),
                    Help = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamFormFields", x => x.Id);
                    table.CheckConstraint("CK_KurdnezamFormFields_Kind", "[Kind] IN ('text', 'file')");
                    table.ForeignKey(
                        name: "FK_KurdnezamFormFields_KurdnezamForms_FormId",
                        column: x => x.FormId,
                        principalTable: "KurdnezamForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamNews_FormId",
                table: "KurdnezamNews",
                column: "FormId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormAnswers_FieldId",
                table: "KurdnezamFormAnswers",
                column: "FieldId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormAnswers_SubmissionId",
                table: "KurdnezamFormAnswers",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormAttachments_FieldId",
                table: "KurdnezamFormAttachments",
                column: "FieldId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormAttachments_StoredKey",
                table: "KurdnezamFormAttachments",
                column: "StoredKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormAttachments_SubmissionId",
                table: "KurdnezamFormAttachments",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormFields_FormId_SortOrder",
                table: "KurdnezamFormFields",
                columns: new[] { "FormId", "SortOrder" });

            migrationBuilder.AddForeignKey(
                name: "FK_KurdnezamNews_KurdnezamForms_FormId",
                table: "KurdnezamNews",
                column: "FormId",
                principalTable: "KurdnezamForms",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_KurdnezamNews_KurdnezamForms_FormId",
                table: "KurdnezamNews");

            migrationBuilder.DropTable(
                name: "KurdnezamFormAnswers");

            migrationBuilder.DropTable(
                name: "KurdnezamFormAttachments");

            migrationBuilder.DropTable(
                name: "KurdnezamFormFields");

            migrationBuilder.DropIndex(
                name: "IX_KurdnezamNews_FormId",
                table: "KurdnezamNews");

            migrationBuilder.DropColumn(
                name: "FormId",
                table: "KurdnezamNews");

            migrationBuilder.DropColumn(
                name: "SuccessMessage",
                table: "KurdnezamForms");
        }
    }
}
