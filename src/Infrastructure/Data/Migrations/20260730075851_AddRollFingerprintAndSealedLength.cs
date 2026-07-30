using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRollFingerprintAndSealedLength : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "RollFingerprint",
                table: "Elections",
                type: "binary(8)",
                fixedLength: true,
                maxLength: 8,
                nullable: true);

            migrationBuilder.AlterColumn<byte[]>(
                name: "Sealed",
                table: "ElectionBallots",
                type: "varbinary(512)",
                maxLength: 512,
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "varbinary(max)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RollFingerprint",
                table: "Elections");

            migrationBuilder.AlterColumn<byte[]>(
                name: "Sealed",
                table: "ElectionBallots",
                type: "varbinary(max)",
                nullable: false,
                oldClrType: typeof(byte[]),
                oldType: "varbinary(512)",
                oldMaxLength: 512);
        }
    }
}
