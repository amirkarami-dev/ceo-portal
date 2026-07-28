-- Identity tables have filtered unique indexes (e.g. on NormalizedUserName), whose
-- inserts require QUOTED_IDENTIFIER ON. sqlcmd defaults it OFF, so set it explicitly.
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

-- =============================================================================
-- sso-migrate-users.sql
-- Copies ASP.NET Identity rows from the app DB (CeoDb) into the IdP DB
-- (CeoAuthDb), preserving each user's Id + password hash.
--
-- RECONCILES with the IdP's boot seeding (the IdP seeds Administrator/User roles
-- and an admin user on first start):
--   â€¢ Roles      â€” matched by NormalizedName (the seeded roles are reused; the app's
--                  role GUIDs are NOT copied).
--   â€¢ Admin user â€” the IdP-seeded admin (fresh GUID) is DELETED so the app's admin is
--                  inserted with its ORIGINAL Id (keeps Project.OwnerId / Subscription.UserId valid).
--   â€¢ User-roles â€” RoleId is REMAPPED via NormalizedName (app role GUID â†’ IdP role GUID).
--
-- SAFE TO RE-RUN: inserts are guarded with NOT EXISTS; the admin reconciliation
-- deletes only target users that also exist in the source (by NormalizedUserName).
-- DOES NOT touch OpenIddict tables, nor modify/delete any source (CeoDb) rows.
-- =============================================================================

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT '=== SSO user migration: CeoDb -> CeoAuthDb ===';
PRINT 'Started: ' + CONVERT(VARCHAR, GETDATE(), 120);
PRINT '';

-- ---------------------------------------------------------------------------
-- 1. AspNetRoles â€” insert only roles whose NormalizedName is not already present
--    (the IdP seeds Administrator/User, so this is normally a no-op).
-- ---------------------------------------------------------------------------
PRINT 'Step 1/7: AspNetRoles (by name) ...';
INSERT INTO CeoAuthDb.dbo.AspNetRoles (Id, Name, NormalizedName, ConcurrencyStamp)
SELECT s.Id, s.Name, s.NormalizedName, s.ConcurrencyStamp
FROM CeoDb.dbo.AspNetRoles AS s
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetRoles AS t
                  WHERE t.NormalizedName = s.NormalizedName);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' role row(s).';

-- ---------------------------------------------------------------------------
-- 2. AspNetUsers
--    (a) Remove target users that collide (by NormalizedUserName) with a source
--        user â€” i.e. the IdP-seeded admin â€” plus their dependent rows, so the
--        app's version wins with its ORIGINAL Id.
--    (b) Insert all source users (Id + PasswordHash + all columns preserved).
-- ---------------------------------------------------------------------------
PRINT 'Step 2/7: AspNetUsers ...';

DELETE FROM CeoAuthDb.dbo.AspNetUserRoles
 WHERE UserId IN (SELECT t.Id FROM CeoAuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM CeoDb.dbo.AspNetUsers s));
DELETE FROM CeoAuthDb.dbo.AspNetUserClaims
 WHERE UserId IN (SELECT t.Id FROM CeoAuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM CeoDb.dbo.AspNetUsers s));
DELETE FROM CeoAuthDb.dbo.AspNetUserLogins
 WHERE UserId IN (SELECT t.Id FROM CeoAuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM CeoDb.dbo.AspNetUsers s));
DELETE FROM CeoAuthDb.dbo.AspNetUserTokens
 WHERE UserId IN (SELECT t.Id FROM CeoAuthDb.dbo.AspNetUsers t
                  WHERE t.NormalizedUserName IN (SELECT s.NormalizedUserName FROM CeoDb.dbo.AspNetUsers s));
DELETE FROM CeoAuthDb.dbo.AspNetUsers
 WHERE NormalizedUserName IN (SELECT s.NormalizedUserName FROM CeoDb.dbo.AspNetUsers s);
PRINT '  Removed ' + CAST(@@ROWCOUNT AS VARCHAR) + ' colliding target user(s) (e.g. the seeded admin).';

INSERT INTO CeoAuthDb.dbo.AspNetUsers
    (Id, UserName, NormalizedUserName, Email, NormalizedEmail, EmailConfirmed, PasswordHash,
     SecurityStamp, ConcurrencyStamp, PhoneNumber, PhoneNumberConfirmed, TwoFactorEnabled,
     LockoutEnd, LockoutEnabled, AccessFailedCount)
SELECT
    s.Id, s.UserName, s.NormalizedUserName, s.Email, s.NormalizedEmail, s.EmailConfirmed, s.PasswordHash,
    s.SecurityStamp, s.ConcurrencyStamp, s.PhoneNumber, s.PhoneNumberConfirmed, s.TwoFactorEnabled,
    s.LockoutEnd, s.LockoutEnabled, s.AccessFailedCount
FROM CeoDb.dbo.AspNetUsers AS s
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUsers AS t WHERE t.Id = s.Id);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user row(s).';

-- ---------------------------------------------------------------------------
-- 3. AspNetUserClaims (Id is IDENTITY in target -> do not copy Id). FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 3/7: AspNetUserClaims ...';
INSERT INTO CeoAuthDb.dbo.AspNetUserClaims (UserId, ClaimType, ClaimValue)
SELECT s.UserId, s.ClaimType, s.ClaimValue
FROM CeoDb.dbo.AspNetUserClaims AS s
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUserClaims AS t
                  WHERE t.UserId = s.UserId AND t.ClaimType = s.ClaimType AND ISNULL(t.ClaimValue,'') = ISNULL(s.ClaimValue,''));
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-claim row(s).';

-- ---------------------------------------------------------------------------
-- 4. AspNetUserLogins (Google etc.). FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 4/7: AspNetUserLogins ...';
INSERT INTO CeoAuthDb.dbo.AspNetUserLogins (LoginProvider, ProviderKey, ProviderDisplayName, UserId)
SELECT s.LoginProvider, s.ProviderKey, s.ProviderDisplayName, s.UserId
FROM CeoDb.dbo.AspNetUserLogins AS s
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUserLogins AS t
                  WHERE t.LoginProvider = s.LoginProvider AND t.ProviderKey = s.ProviderKey);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-login row(s).';

-- ---------------------------------------------------------------------------
-- 5. AspNetUserRoles â€” RoleId REMAPPED from source role to target role by NormalizedName.
-- ---------------------------------------------------------------------------
PRINT 'Step 5/7: AspNetUserRoles (remapped by role name) ...';
INSERT INTO CeoAuthDb.dbo.AspNetUserRoles (UserId, RoleId)
SELECT sur.UserId, tr.Id
FROM CeoDb.dbo.AspNetUserRoles AS sur
JOIN CeoDb.dbo.AspNetRoles      AS sr ON sr.Id = sur.RoleId
JOIN CeoAuthDb.dbo.AspNetRoles  AS tr ON tr.NormalizedName = sr.NormalizedName
WHERE EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUsers u WHERE u.Id = sur.UserId)
  AND NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUserRoles t
                  WHERE t.UserId = sur.UserId AND t.RoleId = tr.Id);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-role row(s).';

-- ---------------------------------------------------------------------------
-- 6. AspNetRoleClaims â€” RoleId REMAPPED by NormalizedName (Id is IDENTITY -> not copied).
-- ---------------------------------------------------------------------------
PRINT 'Step 6/7: AspNetRoleClaims (remapped) ...';
INSERT INTO CeoAuthDb.dbo.AspNetRoleClaims (RoleId, ClaimType, ClaimValue)
SELECT tr.Id, s.ClaimType, s.ClaimValue
FROM CeoDb.dbo.AspNetRoleClaims AS s
JOIN CeoDb.dbo.AspNetRoles      AS sr ON sr.Id = s.RoleId
JOIN CeoAuthDb.dbo.AspNetRoles  AS tr ON tr.NormalizedName = sr.NormalizedName
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetRoleClaims t
                  WHERE t.RoleId = tr.Id AND t.ClaimType = s.ClaimType AND ISNULL(t.ClaimValue,'') = ISNULL(s.ClaimValue,''));
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' role-claim row(s).';

-- ---------------------------------------------------------------------------
-- 7. AspNetUserTokens. FKs: Users.
-- ---------------------------------------------------------------------------
PRINT 'Step 7/7: AspNetUserTokens ...';
INSERT INTO CeoAuthDb.dbo.AspNetUserTokens (UserId, LoginProvider, Name, Value)
SELECT s.UserId, s.LoginProvider, s.Name, s.Value
FROM CeoDb.dbo.AspNetUserTokens AS s
WHERE NOT EXISTS (SELECT 1 FROM CeoAuthDb.dbo.AspNetUserTokens AS t
                  WHERE t.UserId = s.UserId AND t.LoginProvider = s.LoginProvider AND t.Name = s.Name);
PRINT '  Inserted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' user-token row(s).';

-- ---------------------------------------------------------------------------
-- Verification â€” user/user-role parity (the ones that matter for login + ownership).
-- ---------------------------------------------------------------------------
PRINT '';
PRINT '=== Verification (Delta should be 0 for Users and UserRoles) ===';
SELECT 'AspNetUsers' AS [Table],
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUsers)     AS [Source],
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUsers) AS [Target],
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUsers) -
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUsers) AS [Delta]
UNION ALL
SELECT 'AspNetUserRoles',
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUserRoles),
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUserRoles),
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUserRoles) -
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUserRoles)
UNION ALL
SELECT 'AspNetUserLogins',
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUserLogins),
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUserLogins),
       (SELECT COUNT(*) FROM CeoDb.dbo.AspNetUserLogins) -
       (SELECT COUNT(*) FROM CeoAuthDb.dbo.AspNetUserLogins);

PRINT '';
PRINT 'Done: ' + CONVERT(VARCHAR, GETDATE(), 120);
