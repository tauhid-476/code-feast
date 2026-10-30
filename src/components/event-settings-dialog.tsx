"use client";

import { useState, useTransition } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { updateEventSettingsAction } from "@/app/admin/events/actions";
import { E2BApiKeyGuide } from "@/components/e2b-api-key-guide";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Settings data-icon="inline-start" />
            Settings
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Event Settings</DialogTitle>
          <DialogDescription>
            Update event title, duration, or bring your own E2B API Key for sandboxes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-title">Title</FieldLabel>
              <Input
                id="edit-title"
                name="title"
                defaultValue={currentTitle}
                maxLength={120}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-durationMinutes">Duration (Minutes)</FieldLabel>
              <Input
                id="edit-durationMinutes"
                name="durationMinutes"
                type="number"
                min={1}
                step={1}
                defaultValue={currentDurationMinutes}
                required
              />
            </Field>

            <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
              <Field>
                <FieldLabel htmlFor="edit-e2bApiKey">
                  E2B API Key (BYOK)
                </FieldLabel>
                <Input
                  id="edit-e2bApiKey"
                  name="e2bApiKey"
                  type="password"
                  placeholder={
                    hasCustomE2bKey
                      ? "•••••••• (Key saved. Enter new key to replace)"
                      : "e2b_... (leaves blank to use platform key)"
                  }
                  autoComplete="off"
                />
                <span className="text-xs text-muted-foreground">
                  {hasCustomE2bKey
                    ? "This event has a custom E2B API key configured. Enter a new key to update, or leave blank to keep current."
                    : "If left blank, code runs fall back to the platform environment variable E2B_API_KEY."}
                </span>
              </Field>

              <E2BApiKeyGuide />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
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
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
