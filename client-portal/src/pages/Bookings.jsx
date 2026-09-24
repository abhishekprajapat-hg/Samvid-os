import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { getMyBookings } from "../services/dataService";
import { Card, EmptyState, Skeleton, StatusBadge } from "../components/ui";
import { formatCurrency, formatDate } from "../utils/format";

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyBookings({ limit: 50 })
      .then((data) => setBookings(data.bookings))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Bookings</h1>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState title="No bookings yet" />
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <Card key={booking._id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CalendarCheck aria-hidden="true" size={16} className="text-slate-400" />
                <div>
                  <p className="text-sm font-bold text-slate-900">{booking.bookingCode}</p>
                  <p className="text-xs text-slate-400">
                    {booking.cabinId?.cabinCode}
                    {booking.seatCode ? ` · ${booking.seatCode}` : ""} · {formatDate(booking.startDate)} → {formatDate(booking.endDate)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(booking.price)}</span>
                <StatusBadge status={booking.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bookings;
