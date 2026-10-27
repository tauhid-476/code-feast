import { Badge } from "@/components/ui/badge";

/** One status vocabulary for every organizer surface. */
export function EventStatusBadge({ status }: { status: string }) {
  if (status === "live") return <Badge>live</Badge>;
  if (status === "ended") return <Badge variant="outline">ended</Badge>;
  return <Badge variant="secondary">draft</Badge>;
}
