using Microsoft.AspNetCore.Identity;

namespace Soma.Admin.Api;

public sealed class ApplicationUser : IdentityUser
{
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public enum EventStatus { Draft, Published, Active, Finished, Closed, Cancelled }
public enum ReservationStatus { Confirmed, CheckedIn, CheckedOut, Cancelled, NoShow }

public sealed class ClientProfile
{
    public Guid Id { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class Event
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string Slug { get; set; }
    public string? Description { get; set; }
    public DateTimeOffset StartsAt { get; set; }
    public DateTimeOffset EndsAt { get; set; }
    public DateTimeOffset? ReservationStartsAt { get; set; }
    public DateTimeOffset? ReservationEndsAt { get; set; }
    public int Capacity { get; set; }
    public int OccupiedSlots { get; set; }
    public EventStatus Status { get; set; } = EventStatus.Draft;
    public DateTimeOffset? PublishedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public List<Reservation> Reservations { get; set; } = [];
}

public sealed class Reservation
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Event? Event { get; set; }
    public Guid ClientId { get; set; }
    public ClientProfile? Client { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Confirmed;
    public required string QrTokenHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? CheckedOutAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public DateTimeOffset? NoShowAt { get; set; }
}

public sealed class EventImage
{
    public Guid Id { get; set; }
    public Guid EventId { get; set; }
    public Event? Event { get; set; }
    public required string ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AccessLog
{
    public Guid Id { get; set; }
    public Guid? ReservationId { get; set; }
    public Guid? EventId { get; set; }
    public required string StaffUserId { get; set; }
    public required string Action { get; set; }
    public required string Result { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class RefreshToken
{
    public Guid Id { get; set; }
    public required string UserId { get; set; }
    public ApplicationUser? User { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
