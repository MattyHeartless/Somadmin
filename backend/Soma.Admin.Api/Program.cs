using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Soma.Admin.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<SomaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("SqlServer")));
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.Password.RequiredLength = 12;
    options.Password.RequireNonAlphanumeric = true;
})
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<SomaDbContext>();
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.Configure<BootstrapAdminOptions>(builder.Configuration.GetSection(BootstrapAdminOptions.SectionName));
var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("JWT configuration is required.");
if (jwtOptions.SigningKey.Length < 32) throw new InvalidOperationException("JWT signing key must contain at least 32 characters.");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"))
    .AddPolicy("AccessOperator", policy => policy.RequireRole("Admin", "AccessStaff"));
builder.Services.AddCors(options => options.AddPolicy("AdminFrontend", policy =>
    policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? [])
        .AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", context => CreateRateLimit(context, 10));
    options.AddPolicy("access", context => CreateRateLimit(context, 60));
});
builder.Services.AddScoped<AccessService>();
builder.Services.AddScoped<TokenService>();

var app = builder.Build();
await IdentitySeeder.SeedAsync(app.Services);
app.UseExceptionHandler(exceptionApp => exceptionApp.Run(async context =>
{
    context.Response.StatusCode = StatusCodes.Status500InternalServerError;
    await Results.Problem(
        title: "Unexpected server error",
        statusCode: StatusCodes.Status500InternalServerError,
        extensions: new Dictionary<string, object?> { ["code"] = "INTERNAL_ERROR" })
        .ExecuteAsync(context);
}));
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Cache-Control"] = "no-store";
    await next();
});
app.UseHttpsRedirection();
app.UseCors("AdminFrontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", async (SomaDbContext db, CancellationToken cancellationToken) =>
    await db.Database.CanConnectAsync(cancellationToken)
        ? Results.Ok(new { status = "healthy" })
        : Results.Problem(statusCode: StatusCodes.Status503ServiceUnavailable));

var auth = app.MapGroup("/api/auth");
auth.MapPost("/login", async (LoginRequest request, SomaDbContext db, UserManager<ApplicationUser> users, TokenService tokens) =>
{
    var user = await users.FindByEmailAsync(request.Email.Trim());
    if (user is null || !user.IsActive || !await users.CheckPasswordAsync(user, request.Password))
        return Results.Unauthorized();
    var roles = await users.GetRolesAsync(user);
    var token = tokens.CreateAccessToken(user, roles);
    var refreshToken = tokens.CreateRefreshToken();
    return Results.Ok(await CreateLoginResponseAsync(user, roles, token, refreshToken, tokens, db));
}).RequireRateLimiting("auth");
auth.MapPost("/refresh", async (RefreshRequest request, SomaDbContext db, UserManager<ApplicationUser> users, TokenService tokens) =>
{
    var hash = tokens.HashRefreshToken(request.RefreshToken);
    var stored = await db.RefreshTokens.Include(token => token.User).SingleOrDefaultAsync(token => token.TokenHash == hash);
    if (stored?.User is null || stored.RevokedAt is not null || stored.ExpiresAt <= DateTimeOffset.UtcNow || !stored.User.IsActive)
        return Results.Unauthorized();
    stored.RevokedAt = DateTimeOffset.UtcNow;
    var roles = await users.GetRolesAsync(stored.User);
    var accessToken = tokens.CreateAccessToken(stored.User, roles);
    var refreshToken = tokens.CreateRefreshToken();
    await db.SaveChangesAsync();
    return Results.Ok(await CreateLoginResponseAsync(stored.User, roles, accessToken, refreshToken, tokens, db));
});
auth.MapPost("/logout", async (RefreshRequest request, SomaDbContext db, TokenService tokens) =>
{
    var stored = await db.RefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == tokens.HashRefreshToken(request.RefreshToken));
    if (stored is not null && stored.RevokedAt is null)
    {
        stored.RevokedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
    }
    return Results.NoContent();
});

var admin = app.MapGroup("/api/admin").RequireAuthorization("AdminOnly");
admin.MapGet("/events", async (SomaDbContext db, CancellationToken cancellationToken) =>
    await db.Events.AsNoTracking()
        .OrderByDescending(e => e.StartsAt)
        .Select(e => new EventSummary(e.Id, e.Title, e.Slug, e.StartsAt, e.EndsAt, e.Capacity, e.OccupiedSlots, e.Status))
        .ToListAsync(cancellationToken));

admin.MapPost("/events", async (CreateEventRequest request, SomaDbContext db, CancellationToken cancellationToken) =>
{
    if (request.Capacity < 1 || request.EndsAt <= request.StartsAt)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["event"] = ["Capacity and dates are invalid."] });

    var @event = new Event
    {
        Id = Guid.NewGuid(),
        Title = request.Title.Trim(),
        Slug = request.Slug.Trim().ToLowerInvariant(),
        Description = request.Description?.Trim(),
        StartsAt = request.StartsAt,
        EndsAt = request.EndsAt,
        ReservationStartsAt = request.ReservationStartsAt,
        ReservationEndsAt = request.ReservationEndsAt,
        Capacity = request.Capacity
    };
    db.Events.Add(@event);
    await db.SaveChangesAsync(cancellationToken);
    return Results.Created($"/api/admin/events/{@event.Id}", new EventSummary(@event.Id, @event.Title, @event.Slug, @event.StartsAt, @event.EndsAt, @event.Capacity, @event.OccupiedSlots, @event.Status));
});
admin.MapPut("/events/{eventId:guid}", async (Guid eventId, UpdateEventRequest request, SomaDbContext db, CancellationToken cancellationToken) =>
{
    if (request.Capacity < 1 || request.EndsAt <= request.StartsAt)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["event"] = ["Capacity and dates are invalid."] });
    var @event = await db.Events.SingleOrDefaultAsync(evt => evt.Id == eventId, cancellationToken);
    if (@event is null) return Results.NotFound(new { code = "EVENT_NOT_FOUND" });
    if (@event.Status is EventStatus.Cancelled or EventStatus.Finished)
        return Results.Conflict(new { code = "EVENT_NOT_EDITABLE" });
    if (request.Capacity < @event.OccupiedSlots)
        return Results.Conflict(new { code = "CAPACITY_BELOW_OCCUPIED_SLOTS" });
    @event.Title = request.Title.Trim();
    @event.Slug = request.Slug.Trim().ToLowerInvariant();
    @event.Description = request.Description?.Trim();
    @event.StartsAt = request.StartsAt;
    @event.EndsAt = request.EndsAt;
    @event.ReservationStartsAt = request.ReservationStartsAt;
    @event.ReservationEndsAt = request.ReservationEndsAt;
    @event.Capacity = request.Capacity;
    @event.UpdatedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync(cancellationToken);
    return Results.Ok(new EventSummary(@event.Id, @event.Title, @event.Slug, @event.StartsAt, @event.EndsAt, @event.Capacity, @event.OccupiedSlots, @event.Status));
});
admin.MapDelete("/events/{eventId:guid}", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
{
    var @event = await db.Events.SingleOrDefaultAsync(evt => evt.Id == eventId, cancellationToken);
    if (@event is null) return Results.NotFound(new { code = "EVENT_NOT_FOUND" });
    if (@event.Status != EventStatus.Draft || @event.OccupiedSlots != 0)
        return Results.Conflict(new { code = "EVENT_NOT_DELETABLE" });
    db.Events.Remove(@event);
    await db.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
});

admin.MapPost("/events/{eventId:guid}/publish", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await ChangeEventStatus(eventId, EventStatus.Published, db, cancellationToken));
admin.MapPost("/events/{eventId:guid}/activate", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await ChangeEventStatus(eventId, EventStatus.Active, db, cancellationToken));
admin.MapPost("/events/{eventId:guid}/close", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await ChangeEventStatus(eventId, EventStatus.Closed, db, cancellationToken));
admin.MapPost("/events/{eventId:guid}/finish", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await ChangeEventStatus(eventId, EventStatus.Finished, db, cancellationToken));
admin.MapPost("/events/{eventId:guid}/cancel", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await ChangeEventStatus(eventId, EventStatus.Cancelled, db, cancellationToken));
admin.MapGet("/events/{eventId:guid}", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
{
    var @event = await db.Events.AsNoTracking().SingleOrDefaultAsync(evt => evt.Id == eventId, cancellationToken);
    return @event is null ? Results.NotFound(new { code = "EVENT_NOT_FOUND" }) : Results.Ok(@event);
});
admin.MapGet("/events/{eventId:guid}/reservations", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await db.Reservations.AsNoTracking().Where(reservation => reservation.EventId == eventId)
        .OrderByDescending(reservation => reservation.CreatedAt)
        .Select(reservation => new ReservationSummary(reservation.Id, reservation.EventId, reservation.ClientId, reservation.Status, reservation.CreatedAt, reservation.CheckedInAt, reservation.CheckedOutAt))
        .ToListAsync(cancellationToken));
admin.MapGet("/events/{eventId:guid}/images", async (Guid eventId, SomaDbContext db, CancellationToken cancellationToken) =>
    await db.EventImages.AsNoTracking().Where(image => image.EventId == eventId)
        .OrderBy(image => image.DisplayOrder)
        .Select(image => new EventImageSummary(image.Id, image.ImageUrl, image.DisplayOrder))
        .ToListAsync(cancellationToken));
admin.MapPost("/events/{eventId:guid}/images", async (Guid eventId, AddEventImageRequest request, SomaDbContext db, CancellationToken cancellationToken) =>
{
    if (!Uri.TryCreate(request.ImageUrl, UriKind.Absolute, out _))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["imageUrl"] = ["ImageUrl must be an absolute URL."] });
    if (!await db.Events.AnyAsync(evt => evt.Id == eventId, cancellationToken))
        return Results.NotFound(new { code = "EVENT_NOT_FOUND" });
    var image = new EventImage { Id = Guid.NewGuid(), EventId = eventId, ImageUrl = request.ImageUrl, DisplayOrder = request.DisplayOrder };
    db.EventImages.Add(image);
    await db.SaveChangesAsync(cancellationToken);
    return Results.Created($"/api/admin/events/{eventId}/images/{image.Id}", new EventImageSummary(image.Id, image.ImageUrl, image.DisplayOrder));
});
admin.MapDelete("/events/{eventId:guid}/images/{imageId:guid}", async (Guid eventId, Guid imageId, SomaDbContext db, CancellationToken cancellationToken) =>
{
    var image = await db.EventImages.SingleOrDefaultAsync(item => item.Id == imageId && item.EventId == eventId, cancellationToken);
    if (image is null) return Results.NotFound(new { code = "EVENT_IMAGE_NOT_FOUND" });
    db.EventImages.Remove(image);
    await db.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
});

admin.MapGet("/dashboard", async (SomaDbContext db, CancellationToken cancellationToken) =>
{
    var activeEvent = await db.Events.AsNoTracking().Where(e => e.Status == EventStatus.Active)
        .OrderBy(e => e.StartsAt).FirstOrDefaultAsync(cancellationToken);
    var eventCount = await db.Events.CountAsync(cancellationToken);
    if (activeEvent is null)
        return Results.Ok(new { activeEvent = (object?)null, eventCount, metrics = (object?)null });
    var statuses = await db.Reservations.AsNoTracking().Where(reservation => reservation.EventId == activeEvent.Id)
        .GroupBy(reservation => reservation.Status)
        .Select(group => new { Status = group.Key, Count = group.Count() })
        .ToDictionaryAsync(group => group.Status, group => group.Count, cancellationToken);
    var checkedIn = statuses.GetValueOrDefault(ReservationStatus.CheckedIn);
    var checkedOut = statuses.GetValueOrDefault(ReservationStatus.CheckedOut);
    var confirmed = statuses.GetValueOrDefault(ReservationStatus.Confirmed);
    var cancelled = statuses.GetValueOrDefault(ReservationStatus.Cancelled);
    var noShow = statuses.GetValueOrDefault(ReservationStatus.NoShow);
    return Results.Ok(new
    {
        activeEvent,
        eventCount,
        metrics = new
        {
            capacity = activeEvent.Capacity,
            occupiedSlots = activeEvent.OccupiedSlots,
            availableSlots = activeEvent.Capacity - activeEvent.OccupiedSlots,
            confirmed,
            checkedIn,
            checkedOut,
            cancelled,
            noShow,
            insideNow = checkedIn
        }
    });
});
admin.MapGet("/reservations", async (SomaDbContext db, CancellationToken cancellationToken) =>
    await db.Reservations.AsNoTracking().OrderByDescending(reservation => reservation.CreatedAt)
        .Select(reservation => new ReservationSummary(reservation.Id, reservation.EventId, reservation.ClientId, reservation.Status, reservation.CreatedAt, reservation.CheckedInAt, reservation.CheckedOutAt))
        .ToListAsync(cancellationToken));
admin.MapPost("/reservations/{reservationId:guid}/cancel", async (Guid reservationId, SomaDbContext db, CancellationToken cancellationToken) =>
{
    var reservation = await db.Reservations.SingleOrDefaultAsync(item => item.Id == reservationId, cancellationToken);
    if (reservation is null) return Results.NotFound(new { code = "RESERVATION_NOT_FOUND" });
    if (reservation.Status != ReservationStatus.Confirmed)
        return Results.Conflict(new { code = "RESERVATION_NOT_CANCELLABLE" });
    var now = DateTimeOffset.UtcNow;
    await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
    var changed = await db.Reservations.Where(item => item.Id == reservationId && item.Status == ReservationStatus.Confirmed)
        .ExecuteUpdateAsync(setters => setters.SetProperty(item => item.Status, ReservationStatus.Cancelled).SetProperty(item => item.CancelledAt, now), cancellationToken);
    if (changed != 1) return Results.Conflict(new { code = "RESERVATION_NOT_CANCELLABLE" });
    var released = await db.Database.ExecuteSqlInterpolatedAsync($"""
        UPDATE Events SET OccupiedSlots = OccupiedSlots - 1, UpdatedAt = {now}
        WHERE Id = {reservation.EventId} AND OccupiedSlots > 0
        """, cancellationToken);
    if (released != 1) throw new InvalidOperationException("OccupiedSlots invariant violated.");
    await transaction.CommitAsync(cancellationToken);
    return Results.NoContent();
});
admin.MapGet("/access-logs", async (Guid? eventId, SomaDbContext db, CancellationToken cancellationToken) =>
{
    var query = db.AccessLogs.AsNoTracking().OrderByDescending(log => log.CreatedAt).AsQueryable();
    if (eventId is not null) query = query.Where(log => log.EventId == eventId);
    return await query.Take(200)
        .Select(log => new AccessLogSummary(log.Id, log.ReservationId, log.EventId, log.StaffUserId, log.Action, log.Result, log.CreatedAt))
        .ToListAsync(cancellationToken);
});
admin.MapGet("/clients", async (SomaDbContext db, CancellationToken cancellationToken) =>
    await db.ClientProfiles.AsNoTracking().Include(client => client.User)
        .OrderByDescending(client => client.CreatedAt)
        .Select(client => new ClientSummary(client.Id, client.User!.FirstName, client.User.LastName, client.User.Email!, client.User.PhoneNumber))
        .ToListAsync(cancellationToken));
admin.MapPost("/clients", async (CreateClientRequest request, SomaDbContext db, UserManager<ApplicationUser> users) =>
{
    var user = new ApplicationUser
    {
        UserName = request.Email.Trim(),
        Email = request.Email.Trim(),
        PhoneNumber = request.PhoneNumber?.Trim(),
        EmailConfirmed = true,
        FirstName = request.FirstName.Trim(),
        LastName = request.LastName.Trim()
    };
    var created = await users.CreateAsync(user, request.Password);
    if (!created.Succeeded)
        return Results.ValidationProblem(created.Errors.GroupBy(error => error.Code).ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
    await users.AddToRoleAsync(user, "Client");
    var profile = new ClientProfile { Id = Guid.NewGuid(), UserId = user.Id };
    db.ClientProfiles.Add(profile);
    await db.SaveChangesAsync();
    return Results.Created($"/api/admin/clients/{profile.Id}", new ClientSummary(profile.Id, user.FirstName, user.LastName, user.Email!, user.PhoneNumber));
});

admin.MapGet("/staff", async (UserManager<ApplicationUser> users, CancellationToken cancellationToken) =>
{
    var staff = await users.Users.AsNoTracking().OrderBy(user => user.FirstName).ToListAsync(cancellationToken);
    var response = new List<StaffSummary>();
    foreach (var user in staff)
    {
        var roles = await users.GetRolesAsync(user);
        if (roles.Any(role => role is "Admin" or "AccessStaff"))
            response.Add(new StaffSummary(user.Id, user.FirstName, user.LastName, user.Email!, user.IsActive, [.. roles]));
    }
    return Results.Ok(response);
});
admin.MapPost("/staff", async (CreateStaffRequest request, UserManager<ApplicationUser> users) =>
{
    if (request.Role is not ("Admin" or "AccessStaff"))
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["role"] = ["Role must be Admin or AccessStaff."] });
    var user = new ApplicationUser
    {
        UserName = request.Email.Trim(),
        Email = request.Email.Trim(),
        EmailConfirmed = true,
        FirstName = request.FirstName.Trim(),
        LastName = request.LastName.Trim()
    };
    var created = await users.CreateAsync(user, request.Password);
    if (!created.Succeeded)
        return Results.ValidationProblem(created.Errors.GroupBy(error => error.Code).ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
    await users.AddToRoleAsync(user, request.Role);
    return Results.Created($"/api/admin/staff/{user.Id}", new StaffSummary(user.Id, user.FirstName, user.LastName, user.Email!, user.IsActive, [request.Role]));
});
admin.MapPost("/staff/{userId}/deactivate", async (string userId, UserManager<ApplicationUser> users) =>
{
    var user = await users.FindByIdAsync(userId);
    if (user is null) return Results.NotFound(new { code = "STAFF_NOT_FOUND" });
    user.IsActive = false;
    await users.UpdateAsync(user);
    return Results.NoContent();
});
admin.MapPost("/staff/{userId}/activate", async (string userId, UserManager<ApplicationUser> users) =>
{
    var user = await users.FindByIdAsync(userId);
    if (user is null) return Results.NotFound(new { code = "STAFF_NOT_FOUND" });
    user.IsActive = true;
    await users.UpdateAsync(user);
    return Results.NoContent();
});
admin.MapPost("/staff/{userId}/reset-password", async (string userId, ResetPasswordRequest request, UserManager<ApplicationUser> users) =>
{
    var user = await users.FindByIdAsync(userId);
    if (user is null) return Results.NotFound(new { code = "STAFF_NOT_FOUND" });
    var token = await users.GeneratePasswordResetTokenAsync(user);
    var result = await users.ResetPasswordAsync(user, token, request.NewPassword);
    return result.Succeeded
        ? Results.NoContent()
        : Results.ValidationProblem(result.Errors.GroupBy(error => error.Code).ToDictionary(group => group.Key, group => group.Select(error => error.Description).ToArray()));
});

app.MapPost("/api/public/events/{slug}/reservations", async (
    string slug,
    CreateReservationRequest request,
    SomaDbContext db,
    CancellationToken cancellationToken) =>
{
    var @event = await db.Events.SingleOrDefaultAsync(e => e.Slug == slug, cancellationToken);
    if (@event is null) return Results.NotFound(new { code = "EVENT_NOT_FOUND" });
    if (@event.Status is EventStatus.Closed or EventStatus.Cancelled or EventStatus.Finished)
        return Results.Conflict(new { code = "EVENT_NOT_ACTIVE" });

    await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
    var changed = await db.Database.ExecuteSqlInterpolatedAsync($"""
        UPDATE Events SET OccupiedSlots = OccupiedSlots + 1, UpdatedAt = {DateTimeOffset.UtcNow}
        WHERE Id = {@event.Id} AND OccupiedSlots < Capacity
        """, cancellationToken);
    if (changed != 1) return Results.Conflict(new { code = "EVENT_FULL" });

    var reservation = new Reservation
    {
        Id = Guid.NewGuid(),
        EventId = @event.Id,
        ClientId = request.ClientId,
        QrTokenHash = HashToken(request.QrToken)
    };
    db.Reservations.Add(reservation);
    await db.SaveChangesAsync(cancellationToken);
    await transaction.CommitAsync(cancellationToken);
    return Results.Created($"/api/admin/reservations/{reservation.Id}", new { reservation.Id, reservation.Status });
});

var access = app.MapGroup("/api/access").RequireAuthorization("AccessOperator");
access.MapPost("/check-in", async (AccessRequest request, ClaimsPrincipal principal, AccessService service, CancellationToken cancellationToken) =>
    Results.Json(await service.CheckInAsync(request.EventId, request.Token, principal.FindFirstValue(ClaimTypes.NameIdentifier)!, cancellationToken)));
access.MapPost("/check-out", async (AccessRequest request, ClaimsPrincipal principal, AccessService service, CancellationToken cancellationToken) =>
    Results.Json(await service.CheckOutAsync(request.EventId, request.Token, principal.FindFirstValue(ClaimTypes.NameIdentifier)!, cancellationToken)));
access.RequireRateLimiting("access");

app.Run();

static async Task<IResult> ChangeEventStatus(Guid eventId, EventStatus status, SomaDbContext db, CancellationToken cancellationToken)
{
    var @event = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, cancellationToken);
    if (@event is null) return Results.NotFound(new { code = "EVENT_NOT_FOUND" });
    if (!CanTransition(@event.Status, status))
        return Results.Conflict(new { code = "INVALID_EVENT_TRANSITION", currentStatus = @event.Status, targetStatus = status });
    @event.Status = status;
    @event.UpdatedAt = DateTimeOffset.UtcNow;
    if (status == EventStatus.Published) @event.PublishedAt = DateTimeOffset.UtcNow;
    await db.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
}

static bool CanTransition(EventStatus current, EventStatus target) => (current, target) switch
{
    (EventStatus.Draft, EventStatus.Published) => true,
    (EventStatus.Published, EventStatus.Active) => true,
    (EventStatus.Published, EventStatus.Closed) => true,
    (EventStatus.Active, EventStatus.Finished) => true,
    (EventStatus.Active, EventStatus.Closed) => true,
    (_, EventStatus.Cancelled) when current != EventStatus.Finished => true,
    _ => false
};

static string HashToken(string token) =>
    Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));

static RateLimitPartition<string> CreateRateLimit(HttpContext context, int permitLimit) =>
    RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitLimit,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst
        });

static async Task<LoginResponse> CreateLoginResponseAsync(ApplicationUser user, IList<string> roles, string accessToken, string refreshToken, TokenService tokens, SomaDbContext db)
{
    db.RefreshTokens.Add(new RefreshToken
    {
        Id = Guid.NewGuid(),
        UserId = user.Id,
        TokenHash = tokens.HashRefreshToken(refreshToken),
        ExpiresAt = DateTimeOffset.UtcNow.AddDays(TokenService.RefreshTokenLifetimeDays)
    });
    await db.SaveChangesAsync();
    return new LoginResponse(accessToken, refreshToken, DateTimeOffset.UtcNow.AddMinutes(15), [.. roles], $"{user.FirstName} {user.LastName}".Trim());
}

record CreateEventRequest(string Title, string Slug, string? Description, DateTimeOffset StartsAt, DateTimeOffset EndsAt, DateTimeOffset? ReservationStartsAt, DateTimeOffset? ReservationEndsAt, int Capacity);
record UpdateEventRequest(string Title, string Slug, string? Description, DateTimeOffset StartsAt, DateTimeOffset EndsAt, DateTimeOffset? ReservationStartsAt, DateTimeOffset? ReservationEndsAt, int Capacity);
record EventSummary(Guid Id, string Title, string Slug, DateTimeOffset StartsAt, DateTimeOffset EndsAt, int Capacity, int OccupiedSlots, EventStatus Status);
record CreateReservationRequest(Guid ClientId, string QrToken);
record AccessRequest(Guid EventId, string Token);
record ReservationSummary(Guid Id, Guid EventId, Guid ClientId, ReservationStatus Status, DateTimeOffset CreatedAt, DateTimeOffset? CheckedInAt, DateTimeOffset? CheckedOutAt);
record ClientSummary(Guid Id, string FirstName, string LastName, string Email, string? PhoneNumber);
record CreateClientRequest(string FirstName, string LastName, string Email, string Password, string? PhoneNumber);
record CreateStaffRequest(string FirstName, string LastName, string Email, string Password, string Role);
record ResetPasswordRequest(string NewPassword);
record StaffSummary(string Id, string FirstName, string LastName, string Email, bool IsActive, string[] Roles);
record AccessLogSummary(Guid Id, Guid? ReservationId, Guid? EventId, string StaffUserId, string Action, string Result, DateTimeOffset CreatedAt);
record AddEventImageRequest(string ImageUrl, int DisplayOrder);
record EventImageSummary(Guid Id, string ImageUrl, int DisplayOrder);
