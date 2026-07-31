using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class RelaxRoomJoinTokenCheckForDeleted : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rooms_JoinTokenMatchesMode",
                table: "Rooms");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rooms_JoinTokenMatchesMode",
                table: "Rooms",
                sql: "([JoinMode] = 0 AND [JoinToken] IS NULL) OR ([JoinMode] <> 0 AND ([JoinToken] IS NOT NULL OR [IsDeleted] = 1))");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Rooms_JoinTokenMatchesMode",
                table: "Rooms");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Rooms_JoinTokenMatchesMode",
                table: "Rooms",
                sql: "([JoinMode] = 0 AND [JoinToken] IS NULL) OR ([JoinMode] <> 0 AND [JoinToken] IS NOT NULL)");
        }
    }
}
