-- Identity tables have filtered unique indexes (e.g. on NormalizedUserName), whose
-- inserts require QUOTED_IDENTIFIER ON. sqlcmd defaults it OFF, so set it explicitly.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- =============================================================================
-- sso-migrate-users.sql
-- Copies ASP.NET Identity rows from the app DB (Mabhas19Db) into the IdP DB
-- (Mabhas19AuthDb), preserving each user's Id + password hash.
--
-- RECONCILES with the IdP's boot seeding (the IdP seeds Administrator/User roles
-- and an admin user on first start):
--   • Roles      — matched by NormalizedName (the seeded roles are reused; the app's
--                  role GUIDs are NOT copied).
--   • Admin user — the IdP-seeded admin (fresh GUID) is DELETED so the app's admin is
--                  inserted with its ORIGINAL Id (keeps Project.OwnerId / Subscription.UserId valid).
--   • User-roles — RoleId is REMAPPED via NormalizedName (app role GUID → IdP role GUID).
--
-- SAFE TO RE-RUN: inserts are guarded with NOT EXISTS; the admin reconciliation
-- deletes only target users that also exist in the source (by NormalizedUserName).
-- DOES NOT touch OpenIddict tables, nor modify/delete any source (Mabhas19Db) rows.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '=== SSO user migration: Mabhas19Db -> Mabhas19AuthDb ===';
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '';

-- ---------------------------------------------------------------------------
-- 1. AspNetRoles — insert only roles whose NormalizedName is not already present
--    (the IdP seeds Administrator/User, so this is normally a no-op).
-- ---------------------------------------------------------------------------
PRINT 'Step 1/7: AspNetRoles (by name) ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetRoles (Id, Name, NormalizedName, ConcurrencyStamp)
SELECT s.Id, s.Name, s.NormalizedName, s.ConcurrencyStamp
FROM Mabhas19Db.dbo.AspNetRoles AS s
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetRoles AS t
                  WHERE t.NormalizedName = s.NormalizedName);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' role row(s).';

-- ---------------------------------------------------------------------------
-- 2. AspNetUsers
--    (a) Remove target users that collide (by NormalizedUserName) with a source
--        user — i.e. the IdP-seeded admin — plus their dependent rows, so the
--        app's version wins with its ORIGINAL Id.
--    (b) Insert all source users (Id + PasswordHash + all columns preserved).
-- ---------------------------------------------------------------------------
PRINT 'Step 2/7: AspNetUsers ...';

DELETE FROM Mabhas19AuthDb.dbo.AspNetUserRoles
 WHERE UserId IN (SELECT t.Id FROM Mabhas19AuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM Mabhas19Db.dbo.AspNetUsers s));
DELETE FROM Mabhas19AuthDb.dbo.AspNetUserClaims
 WHERE UserId IN (SELECT t.Id FROM Mabhas19AuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM Mabhas19Db.dbo.AspNetUsers s));
DELETE FROM Mabhas19AuthDb.dbo.AspNetUserLogins
 WHERE UserId IN (SELECT t.Id FROM Mabhas19AuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM Mabhas19Db.dbo.AspNetUsers s));
DELETE FROM Mabhas19AuthDb.dbo.AspNetUserTokens
 WHERE UserId IN (SELECT t.Id FROM Mabhas19AuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM Mabhas19Db.dbo.AspNetUsers s));
DELETE FROM Mabhas19AuthDb.dbo.AspNetUsers
 WHERE NormalizedUserName IN (SELECT s.NormalizedUserName FROM Mabhas19Db.dbo.AspNetUsers s);
PRINT '  Removed ' + CAST(@@ROWCOUNT AS VARCHAR) + ' colliding target user(s) (e.g. the seeded admin).';

INSERT INTO Mabhas19AuthDb.dbo.AspNetUsers
    (Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed, PasswordHash,
     SecurityStamp, ConcurrencyStamp, PhoneNumber, PhoneNumberConfirmed, TwoFactorEnabled,
     LockoutEnd, LockoutEnabled, AccessFailedCount)
SELECT
    s.Id, s.UserName, s.NormalizedUserName, s.Email, s.NormalizedEmail, s.EmailConfirmed, s.PasswordHash,
    s.SecurityStamp, s.ConcurrencyStamp, s.PhoneNumber, s.PhoneNumberConfirmed, s.TwoFactorEnabled,
    s.LockoutEnd, s.LockoutEnabled, s.AccessFailedCount
FROM Mabhas19Db.dbo.AspNetUsers AS s
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUsers AS t WHERE t.Id = s.Id);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user row(s).';

-- ---------------------------------------------------------------------------
-- 3. AspNetUserClaims (Id is IDENTITY in target -> do not copy Id). FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 3/7: AspNetUserClaims ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetUserClaims (UserId, ClaimType, ClaimValue)
SELECT s.UserId, s.ClaimType, s.ClaimValue
FROM Mabhas19Db.dbo.AspNetUserClaims AS s
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUserClaims AS t
                  WHERE t.UserId = s.UserId AND t.ClaimType = s.ClaimType AND ISNULL(t.ClaimValue,'') = ISNULL(s.ClaimValue,''));
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-claim row(s).';

-- ---------------------------------------------------------------------------
-- 4. AspNetUserLogins (Google etc.). FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 4/7: AspNetUserLogins ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetUserLogins (LoginProvider, ProviderKey, ProviderDisplayName, UserId)
SELECT s.LoginProvider, s.ProviderKey, s.ProviderDisplayName, s.UserId
FROM Mabhas19Db.dbo.AspNetUserLogins AS s
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUserLogins AS t
                  WHERE t.LoginProvider = s.LoginProvider AND t.ProviderKey = s.ProviderKey);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-login row(s).';

-- ---------------------------------------------------------------------------
-- 5. AspNetUserRoles — RoleId REMAPPED from source role to target role by NormalizedName.
-- ---------------------------------------------------------------------------
PRINT 'Step 5/7: AspNetUserRoles (remapped by role name) ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetUserRoles (UserId, RoleId)
SELECT sur.UserId, tr.Id
FROM Mabhas19Db.dbo.AspNetUserRoles AS sur
JOIN Mabhas19Db.dbo.AspNetRoles      AS sr ON sr.Id = sur.RoleId
JOIN Mabhas19AuthDb.dbo.AspNetRoles  AS tr ON tr.NormalizedName = sr.NormalizedName
WHERE EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUsers u WHERE u.Id = sur.UserId)
  AND NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUserRoles t
                  WHERE t.UserId = sur.UserId AND t.RoleId = tr.Id);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-role row(s).';

-- ---------------------------------------------------------------------------
-- 6. AspNetRoleClaims — RoleId REMAPPED by NormalizedName (Id is IDENTITY -> not copied).
-- ---------------------------------------------------------------------------
PRINT 'Step 6/7: AspNetRoleClaims (remapped) ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetRoleClaims (RoleId, ClaimType, ClaimValue)
SELECT tr.Id, s.ClaimType, s.ClaimValue
FROM Mabhas19Db.dbo.AspNetRoleClaims AS s
JOIN Mabhas19Db.dbo.AspNetRoles      AS sr ON sr.Id = s.RoleId
JOIN Mabhas19AuthDb.dbo.AspNetRoles  AS tr ON tr.NormalizedName = sr.NormalizedName
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetRoleClaims t
                  WHERE t.RoleId = tr.Id AND t.ClaimType = s.ClaimType AND ISNULL(t.ClaimValue,'') = ISNULL(s.ClaimValue,''));
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' role-claim row(s).';

-- ---------------------------------------------------------------------------
-- 7. AspNetUserTokens. FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 7/7: AspNetUserTokens ...';
INSERT INTO Mabhas19AuthDb.dbo.AspNetUserTokens (UserId, LoginProvider, Name, Value)
SELECT s.UserId, s.LoginProvider, s.Name, s.Value
FROM Mabhas19Db.dbo.AspNetUserTokens AS s
WHERE NOT EXISTS (SELECT 1 FROM Mabhas19AuthDb.dbo.AspNetUserTokens AS t
                  WHERE t.UserId = s.UserId AND t.LoginProvider = s.LoginProvider AND t.Name = s.Name);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-token row(s).';

-- ---------------------------------------------------------------------------
-- Verification — user/user-role parity (the ones that matter for login + ownership).
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '=== Verification (Delta should be 0 for Users and UserRoles) ===';
SELECT 'AspNetUsers' AS [Table],
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUsers)     AS [Source],
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUsers) AS [Target],
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUsers) -
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUsers) AS [Delta]
UNION ALL
SELECT 'AspNetUserRoles',
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUserRoles),
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUserRoles),
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUserRoles) -
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUserRoles)
UNION ALL
SELECT 'AspNetUserLogins',
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUserLogins),
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUserLogins),
       (SELECT COUNT(*) FROM Mabhas19Db.dbo.AspNetUserLogins) -
       (SELECT COUNT(*) FROM Mabhas19AuthDb.dbo.AspNetUserLogins);

PRINT '';
PRINT 'Done: ' + CONVERT(VARCHAR, GETDATE(), 120);
