using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;

namespace Soma.Admin.Api;

public sealed class AccessService(SomaDbContext db)
{
    public Task<AccessResult> CheckInAsync(Guid eventId, string token, string staffUserId, CancellationToken cancellationToken) =>
        ChangeAccessAsync(eventId, token, staffUserId, ReservationStatus.Confirmed, ReservationStatus.CheckedIn, "CheckIn", cancellationToken);

    public Task<AccessResult> CheckOutAsync(Guid eventId, string token, string staffUserId, CancellationToken cancellationToken) =>
        ChangeAccessAsync(eventId, token, staffUserId, ReservationStatus.CheckedIn, ReservationStatus.CheckedOut, "CheckOut", cancellationToken);

    private async Task<AccessResult> ChangeAccessAsync(Guid eventId, string token, string staffUserId, ReservationStatus expected, ReservationStatus target, string action, CancellationToken cancellationToken)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));
        var now = DateTimeOffset.UtcNow;
        var @event = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId, cancellationToken);
        if (@event is null) return await LogAndReturnAsync(null, eventId, staffUserId, action, "EventNotFound", cancellationToken);
        if (@event.Status == EventStatus.Cancelled) return await LogAndReturnAsync(null, eventId, staffUserId, action, "EventCancelled", cancellationToken);
        if (action == "CheckIn" && @event.Status != EventStatus.Active) return await LogAndReturnAsync(null, eventId, staffUserId, action, "EventNotActive", cancellationToken);

        var reservation = await db.Reservations.SingleOrDefaultAsync(r => r.EventId == eventId && r.QrTokenHash == hash, cancellationToken);
        if (reservation is null) return await LogAndReturnAsync(null, eventId, staffUserId, action, "InvalidQr", cancellationToken);
        if (reservation.Status != expected) return await LogAndReturnAsync(reservation.Id, eventId, staffUserId, action, ExistingStateResult(reservation.Status), cancellationToken);

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var query = db.Reservations.Where(r => r.Id == reservation.Id && r.Status == expected);
        var rows = target == ReservationStatus.CheckedIn
            ? await query.ExecuteUpdateAsync(setters => setters
                .SetProperty(r => r.Status, target)
                .SetProperty(r => r.CheckedInAt, now), cancellationToken)
            : await query.ExecuteUpdateAsync(setters => setters
                .SetProperty(r => r.Status, target)
                .SetProperty(r => r.CheckedOutAt, now), cancellationToken);
        if (rows != 1)
        {
            var currentStatus = await db.Reservations.AsNoTracking()
                .Where(r => r.Id == reservation.Id)
                .Select(r => r.Status)
                .SingleAsync(cancellationToken);
            await transaction.RollbackAsync(cancellationToken);
            return await LogAndReturnAsync(reservation.Id, eventId, staffUserId, action, ExistingStateResult(currentStatus), cancellationToken);
        }

        if (target == ReservationStatus.CheckedOut)
        {
            var released = await db.Database.ExecuteSqlInterpolatedAsync($"""
                UPDATE Events SET OccupiedSlots = OccupiedSlots - 1, UpdatedAt = {now}
                WHERE Id = {eventId} AND OccupiedSlots > 0
                """, cancellationToken);
            if (released != 1) throw new InvalidOperationException("OccupiedSlots invariant violated.");
        }

        db.AccessLogs.Add(new AccessLog { Id = Guid.NewGuid(), ReservationId = reservation.Id, EventId = eventId, StaffUserId = staffUserId, Action = action, Result = "Success", CreatedAt = now });
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new AccessResult("Success", reservation.Id, target, now);
    }

    private async Task<AccessResult> LogAndReturnAsync(Guid? reservationId, Guid eventId, string staffUserId, string action, string result, CancellationToken cancellationToken)
    {
        db.AccessLogs.Add(new AccessLog { Id = Guid.NewGuid(), ReservationId = reservationId, EventId = eventId, StaffUserId = staffUserId, Action = action, Result = result });
        await db.SaveChangesAsync(cancellationToken);
        return new AccessResult(result, reservationId, null, null);
    }

    private static string ExistingStateResult(ReservationStatus status) => status switch
    {
        ReservationStatus.CheckedIn => "AlreadyCheckedIn",
        ReservationStatus.CheckedOut => "AlreadyCheckedOut",
        ReservationStatus.Cancelled => "Cancelled",
        ReservationStatus.NoShow => "NoShow",
        _ => "InvalidState"
    };
}

public record AccessResult(string Result, Guid? ReservationId, ReservationStatus? Status, DateTimeOffset? ProcessedAt);
