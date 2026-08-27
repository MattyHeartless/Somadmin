using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Soma.Admin.Api;

public sealed class BootstrapAdminOptions
{
    public const string SectionName = "BootstrapAdmin";
    public string? Email { get; init; }
    public string? Password { get; init; }
    public string FirstName { get; init; } = "SOMA";
    public string LastName { get; init; } = "Admin";
}

public static class IdentitySeeder
{
    private static readonly string[] Roles = ["Admin", "AccessStaff", "Client"];

    public static async Task SeedAsync(IServiceProvider services, CancellationToken cancellationToken = default)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SomaDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in Roles)
            if (!await roles.RoleExistsAsync(role))
                await roles.CreateAsync(new IdentityRole(role));

        var options = scope.ServiceProvider.GetRequiredService<IOptions<BootstrapAdminOptions>>().Value;
        if (string.IsNullOrWhiteSpace(options.Email) || string.IsNullOrWhiteSpace(options.Password))
            return;

        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await users.FindByEmailAsync(options.Email) is not null) return;
        var admin = new ApplicationUser
        {
            UserName = options.Email,
            Email = options.Email,
            EmailConfirmed = true,
            FirstName = options.FirstName,
            LastName = options.LastName
        };
        var result = await users.CreateAsync(admin, options.Password);
        if (!result.Succeeded)
            throw new InvalidOperationException($"Bootstrap admin could not be created: {string.Join(", ", result.Errors.Select(error => error.Description))}");
        await users.AddToRoleAsync(admin, "Admin");
    }
}
