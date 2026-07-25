using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Auth.Data;

public class AuthDbContext : IdentityDbContext<AuthUser>
{
    public AuthDbContext(DbContextOptions<AuthDbContext> options) : base(options) { }

    public DbSet<UserServiceAccess> UserServiceAccess => Set<UserServiceAccess>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfiguration(new UserServiceAccessConfiguration());
        builder.UseOpenIddict();
    }
}
