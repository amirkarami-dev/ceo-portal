using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Mabhas19.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddKurdnezam : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KurdnezamCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamContactMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsRead = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamContactMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamFooterLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Href = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamFooterLinks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamForms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Note = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Deadline = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Image = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    IsOpen = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamForms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamOrgPages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Group = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Intro = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamOrgPages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamPeople",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Image = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Group = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamPeople", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamQuickLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Href = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamQuickLinks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NameFa = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    NameKu = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    NameEn = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Tagline = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    PhonesJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Telegram = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Instagram = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamTabGroups",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamTabGroups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamUnits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    HeadName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    HeadRole = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamUnits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamVisits",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VisitedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    SessionId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Path = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamVisits", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamFormSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NationalId = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    MembershipNo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    IsHandled = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamFormSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamFormSubmissions_KurdnezamForms_FormId",
                        column: x => x.FormId,
                        principalTable: "KurdnezamForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamTabItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TabGroupId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Href = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Note = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamTabItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamTabItems_KurdnezamTabGroups_TabGroupId",
                        column: x => x.TabGroupId,
                        principalTable: "KurdnezamTabGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamNews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Summary = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Body = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DateJalali = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    PublishedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    Author = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    UnitId = table.Column<int>(type: "int", nullable: true),
                    Image = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Featured = table.Column<bool>(type: "bit", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamNews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamNews_KurdnezamCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "KurdnezamCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_KurdnezamNews_KurdnezamUnits_UnitId",
                        column: x => x.UnitId,
                        principalTable: "KurdnezamUnits",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "KurdnezamSlides",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Subtitle = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Image = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    NewsId = table.Column<int>(type: "int", nullable: false),
                    Badge = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    Created = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LastModified = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KurdnezamSlides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KurdnezamSlides_KurdnezamNews_NewsId",
                        column: x => x.NewsId,
                        principalTable: "KurdnezamNews",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamCategories_SortOrder",
                table: "KurdnezamCategories",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamContactMessages_IsRead",
                table: "KurdnezamContactMessages",
                column: "IsRead");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFooterLinks_SortOrder",
                table: "KurdnezamFooterLinks",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamForms_SortOrder",
                table: "KurdnezamForms",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormSubmissions_FormId",
                table: "KurdnezamFormSubmissions",
                column: "FormId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamFormSubmissions_IsHandled",
                table: "KurdnezamFormSubmissions",
                column: "IsHandled");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamNews_CategoryId",
                table: "KurdnezamNews",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamNews_Featured",
                table: "KurdnezamNews",
                column: "Featured");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamNews_PublishedAt",
                table: "KurdnezamNews",
                column: "PublishedAt");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamNews_UnitId",
                table: "KurdnezamNews",
                column: "UnitId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamOrgPages_Slug",
                table: "KurdnezamOrgPages",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamPeople_Group",
                table: "KurdnezamPeople",
                column: "Group");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamPeople_SortOrder",
                table: "KurdnezamPeople",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamQuickLinks_SortOrder",
                table: "KurdnezamQuickLinks",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamSlides_NewsId",
                table: "KurdnezamSlides",
                column: "NewsId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamSlides_SortOrder",
                table: "KurdnezamSlides",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamTabGroups_Slug",
                table: "KurdnezamTabGroups",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamTabGroups_SortOrder",
                table: "KurdnezamTabGroups",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamTabItems_TabGroupId",
                table: "KurdnezamTabItems",
                column: "TabGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamUnits_SortOrder",
                table: "KurdnezamUnits",
                column: "SortOrder");

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamVisits_SessionId_VisitedAt",
                table: "KurdnezamVisits",
                columns: new[] { "SessionId", "VisitedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_KurdnezamVisits_VisitedAt",
                table: "KurdnezamVisits",
                column: "VisitedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KurdnezamContactMessages");

            migrationBuilder.DropTable(
                name: "KurdnezamFooterLinks");

            migrationBuilder.DropTable(
                name: "KurdnezamFormSubmissions");

            migrationBuilder.DropTable(
                name: "KurdnezamOrgPages");

            migrationBuilder.DropTable(
                name: "KurdnezamPeople");

            migrationBuilder.DropTable(
                name: "KurdnezamQuickLinks");

            migrationBuilder.DropTable(
                name: "KurdnezamSettings");

            migrationBuilder.DropTable(
                name: "KurdnezamSlides");

            migrationBuilder.DropTable(
                name: "KurdnezamTabItems");

            migrationBuilder.DropTable(
                name: "KurdnezamVisits");

            migrationBuilder.DropTable(
                name: "KurdnezamForms");

            migrationBuilder.DropTable(
                name: "KurdnezamNews");

            migrationBuilder.DropTable(
                name: "KurdnezamTabGroups");

            migrationBuilder.DropTable(
                name: "KurdnezamCategories");

            migrationBuilder.DropTable(
                name: "KurdnezamUnits");
        }
    }
}
