using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Soma.Admin.Api;

public sealed class SomaDbContext(DbContextOptions<SomaDbContext> options)
    : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<ClientProfile> ClientProfiles => Set<ClientProfile>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<EventImage> EventImages => Set<EventImage>();
    public DbSet<AccessLog> AccessLogs => Set<AccessLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<Event>(entity =>
        {
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("CK_Events_Capacity", "[Capacity] > 0");
                table.HasCheckConstraint("CK_Events_OccupiedSlots", "[OccupiedSlots] >= 0 AND [OccupiedSlots] <= [Capacity]");
            });
        });
        builder.Entity<Reservation>(entity =>
        {
            entity.HasIndex(r => r.QrTokenHash).IsUnique();
            entity.HasIndex(r => new { r.EventId, r.Status });
            entity.Property(r => r.Status).HasConversion<string>();
            entity.HasOne(r => r.Client).WithMany().HasForeignKey(r => r.ClientId).OnDelete(DeleteBehavior.Restrict);
        });
        builder.Entity<EventImage>(entity =>
        {
            entity.HasIndex(image => new { image.EventId, image.DisplayOrder }).IsUnique();
            entity.HasOne(image => image.Event).WithMany().HasForeignKey(image => image.EventId).OnDelete(DeleteBehavior.Cascade);
        });
        builder.Entity<ClientProfile>().HasIndex(c => c.UserId).IsUnique();
        builder.Entity<AccessLog>().HasIndex(l => new { l.EventId, l.CreatedAt });
        builder.Entity<RefreshToken>(entity =>
        {
            entity.HasIndex(token => token.TokenHash).IsUnique();
            entity.HasIndex(token => new { token.UserId, token.ExpiresAt });
        });
    }
}
