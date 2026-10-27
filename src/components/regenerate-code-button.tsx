"use client";

import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { regenerateCodeAction } from "@/app/admin/events/actions";
import { Button } from "@/components/ui/button";

export function RegenerateCodeButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition();

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateCodeAction(eventId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Join code regenerated", { description: result.code });
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="min-w-28"
      onClick={regenerate}
      disabled={pending}
    >
      <RotateCw data-icon="inline-start" />
      {pending ? "Working…" : "Regenerate"}
    </Button>
  );
}
