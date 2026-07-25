using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Walfare;

public class WelfareServiceConfiguration : IEntityTypeConfiguration<WelfareService>
{
    public void Configure(EntityTypeBuilder<WelfareService> b)
    {
        b.ToTable("WelfareServices");

        b.Property(x => x.Title).HasMaxLength(300).IsRequired();
        b.Property(x => x.StartDateJalali).HasMaxLength(30).IsRequired();
        b.Property(x => x.EndDateJalali).HasMaxLength(30).IsRequired();
        b.Property(x => x.ActivationDateJalali).HasMaxLength(30).IsRequired();

        b.HasIndex(x => x.Type);
        b.HasIndex(x => x.IsAccessible);
    }
}

public class WelfarePoolConfiguration : IEntityTypeConfiguration<WelfarePool>
{
    public void Configure(EntityTypeBuilder<WelfarePool> b)
    {
        b.ToTable("WelfarePools");

        b.Property(x => x.Name).HasMaxLength(300).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.ReserveStartTime).HasMaxLength(10);
        b.Property(x => x.ReserveEndTime).HasMaxLength(10);

        // Pools die with their service: the service IS the offering period.
        b.HasOne(x => x.Service)
            .WithMany(s => s.Pools)
            .HasForeignKey(x => x.ServiceId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(x => new { x.ServiceId, x.IsActive });
    }
}

public class WelfarePoolReservationConfiguration : IEntityTypeConfiguration<WelfarePoolReservation>
{
    public void Configure(EntityTypeBuilder<WelfarePoolReservation> b)
    {
        b.ToTable("WelfarePoolReservations");

        b.Property(x => x.UserId).HasMaxLength(100).IsRequired();
        b.Property(x => x.DateJalali).HasMaxLength(30).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(300).IsRequired();
        b.Property(x => x.NationalCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.ReshteCode).HasMaxLength(50);
        b.Property(x => x.Mobile).HasMaxLength(20);
        b.Property(x => x.TrackingCode).HasMaxLength(100);

        // A paid ticket is a financial record — never let a pool delete take it silently.
        b.HasOne(x => x.Pool)
            .WithMany(p => p.Reservations)
            .HasForeignKey(x => x.PoolId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.PaymentTransaction)
            .WithMany()
            .HasForeignKey(x => x.PaymentTransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        // Capacity check = count reservations per (pool, day); my-tickets = by user.
        b.HasIndex(x => new { x.PoolId, x.Date });
        b.HasIndex(x => x.UserId);
    }
}

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> b)
    {
        b.ToTable("PaymentTransactions");

        b.Property(x => x.PaymentId).HasMaxLength(50).IsRequired();
        b.Property(x => x.Token).HasMaxLength(200);
        b.Property(x => x.TargetType).HasMaxLength(50).IsRequired();
        b.Property(x => x.UserId).HasMaxLength(100).IsRequired();
        b.Property(x => x.PayerName).HasMaxLength(300);
        b.Property(x => x.PayerNationalCode).HasMaxLength(20);
        b.Property(x => x.ResponseCode).HasMaxLength(20);
        b.Property(x => x.RetrievalReferenceNumber).HasMaxLength(100);
        b.Property(x => x.SystemTraceAuditNumber).HasMaxLength(100);
        b.Property(x => x.MaskedPan).HasMaxLength(50);
        b.Property(x => x.Description).HasMaxLength(1000);

        // The bank callback finds the row by PaymentId (+ token check in code).
        b.HasIndex(x => x.PaymentId).IsUnique();
        b.HasIndex(x => new { x.TargetType, x.TargetId });
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.UserId);
    }
}
