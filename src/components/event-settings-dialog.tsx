"use client";

import { useState, useTransition } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { updateEventSettingsAction } from "@/app/admin/events/actions";
import { E2BApiKeyGuide } from "@/components/e2b-api-key-guide";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function EventSettingsDialog({
  eventId,
  currentTitle,
  currentDurationMinutes,
  hasCustomE2bKey,
}: {
  eventId: string;
  currentTitle: string;
  currentDurationMinutes: number;
  hasCustomE2bKey: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateEventSettingsAction(eventId, null, formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
        toast.success("Event settings updated");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings />
        Settings
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        busy={pending}
        title="Event Settings"
        description="Update event title, duration, or bring your own E2B API Key for sandboxes."
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
      >
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex flex-col gap-4">
            <Field label="Title">
              <Input
                name="title"
                defaultValue={currentTitle}
                maxLength={120}
                required
              />
            </Field>

            <Field label="Duration (Minutes)">
              <Input
                name="durationMinutes"
                type="number"
                min={1}
                step={1}
                defaultValue={currentDurationMinutes}
                required
              />
            </Field>

            <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <Field
                label="E2B API Key (BYOK)"
                hint={
                  hasCustomE2bKey
                    ? "This event has a custom E2B API key configured. Enter a new key to update, or leave blank to keep current."
                    : "If left blank, code runs fall back to the platform environment variable E2B_API_KEY."
                }
              >
                <Input
                  name="e2bApiKey"
                  type="password"
                  placeholder={
                    hasCustomE2bKey
                      ? "•••••••• (Key saved. Enter new key to replace)"
                      : "e2b_... (leaves blank to use platform key)"
                  }
                  autoComplete="off"
                />
              </Field>

              <E2BApiKeyGuide />
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <DialogActions className="mt-0 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save settings"}
              </Button>
            </DialogActions>
          </div>
        </form>
      </Dialog>
    </>
  );
}
