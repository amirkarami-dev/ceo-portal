using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomBoards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "RoomBoards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoomId = table.Column<int>(type: "int", nullable: false),
                    Scene = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomBoards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RoomBoards_Rooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "Rooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RoomBoards_RoomId",
                table: "RoomBoards",
                column: "RoomId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RoomBoards");
        }
    }
}
