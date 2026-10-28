"use client";

import { FlaskConical } from "lucide-react";
import { testProblemAction } from "@/app/admin/events/[id]/actions";
import { TestProblemPanel } from "@/components/test-problem-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * The per-Problem entry point: a row button that opens the panel (SPEC §4.3).
 * The Server Action is wired here so the panel itself stays a plain component.
 */
export function TestProblemDialog({
  eventId,
  problemId,
  problemTitle,
}: {
  eventId: string;
  problemId: string;
  problemTitle: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={`Test ${problemTitle}`} />
        }
      >
        <FlaskConical data-icon="inline-start" />
        Test
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Test this problem</DialogTitle>
          <DialogDescription>
            Paste a reference solution for “{problemTitle}”. It runs against the
            two Sample Test Cases through the real runner and the real Harness,
            so this is what a participant will see.
          </DialogDescription>
        </DialogHeader>
        <TestProblemPanel
          run={(language, code) =>
            testProblemAction(eventId, problemId, language, code)
          }
        />
      </DialogContent>
    </Dialog>
  );
}
