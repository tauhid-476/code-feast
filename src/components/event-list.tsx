import Link from "next/link";
import type { EventSummary } from "@/lib/events/queries";

function statusPill(status: string) {
  if (status === "live") return <span className="pill pill-live">live</span>;
  if (status === "ended") return <span className="pill">ended</span>;
  return <span className="pill">draft</span>;
}

export function EventList({ events }: { events: EventSummary[] }) {
  if (events.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 px-6 py-14 text-center">
        <p className="text-sm font-medium">No events yet</p>
        <p className="max-w-sm text-sm text-muted">
          An event holds the problems, the join code, and the shared clock for
          one contest.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="label px-4 py-3 font-normal">Title</th>
            <th className="label px-4 py-3 font-normal">Status</th>
            <th className="label px-4 py-3 font-normal">Duration</th>
            <th className="label px-4 py-3 font-normal">Join code</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-medium">{event.title}</td>
              <td className="px-4 py-3">{statusPill(event.status)}</td>
              <td className="px-4 py-3 text-muted">{event.durationMinutes} min</td>
              <td className="px-4 py-3">
                <span className="mono tracking-[0.18em]">{event.code}</span>
              </td>
              <td className="px-4 py-3 text-right">
                <Link className="btn btn-ghost" href={`/admin/events/${event.id}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
