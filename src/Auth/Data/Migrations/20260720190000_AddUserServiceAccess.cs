using System;
using Mabhas19.Auth.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Auth.Data.Migrations
{
    /// <summary>
    /// Per-user service-access grants (see <see cref="UserServiceAccess"/>).
    /// </summary>
    /// <remarks>
    /// Hand-authored: the <c>dotnet ef</c> design-time build could not resolve the shared
    /// ServiceDefaults source-generator analyzer on the build box (a NuGet restore quirk; the Docker
    /// publish path that builds the running image is unaffected). The <c>Up</c>/<c>Down</c> below are
    /// exactly what EF would scaffold from <c>UserServiceAccessConfiguration</c>. FOLLOW-UP: once the
    /// analyzer restore is fixed, run <c>dotnet ef migrations add</c> to regenerate
    /// <c>AuthDbContextModelSnapshot</c> (it does not yet include this entity), so the NEXT migration
    /// diffs cleanly. This has no effect on applying the migration at runtime.
    /// </remarks>
    [DbContext(typeof(AuthDbContext))]
    [Migration("20260720190000_AddUserServiceAccess")]
    public partial class AddUserServiceAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserServiceAccess",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    ServiceKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    GrantedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    GrantedBy = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserServiceAccess", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserServiceAccess_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Unique (UserId, ServiceKey). UserId is the leading column, so it also serves the FK —
            // EF does not emit a separate FK index in this case.
            migrationBuilder.CreateIndex(
                name: "IX_UserServiceAccess_UserId_ServiceKey",
                table: "UserServiceAccess",
                columns: new[] { "UserId", "ServiceKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "UserServiceAccess");
        }
    }
}
