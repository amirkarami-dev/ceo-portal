using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class DropKurdnezamFixedSubmissionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FullName",
                table: "KurdnezamFormSubmissions");

            migrationBuilder.DropColumn(
                name: "MembershipNo",
                table: "KurdnezamFormSubmissions");

            migrationBuilder.DropColumn(
                name: "Mobile",
                table: "KurdnezamFormSubmissions");

            migrationBuilder.DropColumn(
                name: "NationalId",
                table: "KurdnezamFormSubmissions");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "KurdnezamFormSubmissions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "KurdnezamFormSubmissions",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "MembershipNo",
                table: "KurdnezamFormSubmissions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Mobile",
                table: "KurdnezamFormSubmissions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NationalId",
                table: "KurdnezamFormSubmissions",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "KurdnezamFormSubmissions",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);
        }
    }
}
