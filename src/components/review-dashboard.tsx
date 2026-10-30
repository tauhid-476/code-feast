"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Clock,
  Code2,
  Loader2,
  Play,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  toggleShortlistAction,
  loadParticipantSubmissionAction,
  rerunSubmissionAction,
} from "@/app/admin/events/[id]/review/actions";
import { ReviewCodeEditor } from "@/components/review-code-editor";
import { RunResultView } from "@/components/run-result";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ParticipantSubmissionDetail,
  ReviewParticipant,
} from "@/lib/review/queries";
import type { RunResult } from "@/lib/runner/run";
import { formatDuration } from "@/lib/time";
import type { ViolationKind } from "@/lib/violations/kinds";

const VIOLATION_LABELS: Record<ViolationKind, string> = {
  paste_blocked: "Paste attempt (blocked)",
  context_menu_blocked: "Context menu attempt (blocked)",
  fullscreen_exit: "Exited fullscreen (strike)",
  focus_lost: "Lost window focus (strike)",
  duplicate_session: "Duplicate session opened (strike)",
};

const REASON_LABELS: Record<string, string> = {
  submitted: "Submitted",
  deadline: "Deadline",
  eliminated: "Eliminated",
};

function formatTimestamp(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatFullDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function ReviewDashboard({
  eventId,
  initialParticipants,
  initialSelectedDetail = null,
}: {
  eventId: string;
  initialParticipants: ReviewParticipant[];
  initialSelectedDetail?: ParticipantSubmissionDetail | null;
}) {
  const [participants, setParticipants] =
    useState<ReviewParticipant[]>(initialParticipants);
  const [selectedDetail, setSelectedDetail] =
    useState<ParticipantSubmissionDetail | null>(initialSelectedDetail);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);
  const [, startTransition] = useTransition();

  // Statistics
  const stats = useMemo(() => {
    let submitted = 0;
    let deadline = 0;
    let eliminated = 0;
    let inProgress = 0;
    let shortlisted = 0;

    for (const p of participants) {
      if (p.shortlisted) shortlisted += 1;
      if (p.status === "locked_out") {
        if (p.lockoutReason === "submitted") submitted += 1;
        else if (p.lockoutReason === "deadline") deadline += 1;
        else if (p.lockoutReason === "eliminated") eliminated += 1;
      } else {
        inProgress += 1;
      }
    }

    return {
      total: participants.length,
      submitted,
      deadline,
      eliminated,
      inProgress,
      shortlisted,
    };
  }, [participants]);

  // Filtered roster
  const filteredParticipants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      const matchesSearch =
        !q ||
        p.displayName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === "all") return true;
      if (statusFilter === "shortlisted") return p.shortlisted;
      if (statusFilter === "submitted")
        return p.status === "locked_out" && p.lockoutReason === "submitted";
      if (statusFilter === "deadline")
        return p.status === "locked_out" && p.lockoutReason === "deadline";
      if (statusFilter === "eliminated")
        return p.status === "locked_out" && p.lockoutReason === "eliminated";
      if (statusFilter === "in_progress") return p.status !== "locked_out";

      return true;
    });
  }, [participants, search, statusFilter]);

  async function handleToggleShortlist(participantId: string, e?: React.MouseEvent) {
    e?.stopPropagation();

    // Optimistic update
    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId ? { ...p, shortlisted: !p.shortlisted } : p,
      ),
    );

    if (selectedDetail && selectedDetail.participant.id === participantId) {
      setSelectedDetail((prev) =>
        prev
          ? {
              ...prev,
              participant: {
                ...prev.participant,
                shortlisted: !prev.participant.shortlisted,
              },
            }
          : null,
      );
    }

    startTransition(async () => {
      const result = await toggleShortlistAction(eventId, participantId);
      if ("error" in result) {
        toast.error(result.error);
        // Revert on error
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId ? { ...p, shortlisted: !p.shortlisted } : p,
          ),
        );
      } else {
        toast(
          result.shortlisted
            ? "Participant shortlisted"
            : "Participant removed from shortlist",
        );
      }
    });
  }

  async function handleSelectParticipant(p: ReviewParticipant) {
    if (selectedDetail && selectedDetail.participant.id === p.id) {
      return;
    }

    setIsLoadingSubmission(true);
    const result = await loadParticipantSubmissionAction(eventId, p.id);
    setIsLoadingSubmission(false);

    if ("error" in result) {
      toast.error(result.error);
    } else {
      setSelectedDetail(result.detail);
      // Smooth scroll down to review panel
      const el = document.getElementById("submission-viewer");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <p className="label">Total</p>
          <p className="mt-1 text-2xl font-semibold tabular">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="label">Submitted</p>
          <p className="mt-1 text-2xl font-semibold tabular text-emerald-400">
            {stats.submitted}
          </p>
        </Card>
        <Card className="p-4">
          <p className="label">Deadline</p>
          <p className="mt-1 text-2xl font-semibold tabular">{stats.deadline}</p>
        </Card>
        <Card className="p-4">
          <p className="label">Eliminated</p>
          <p className="mt-1 text-2xl font-semibold tabular text-destructive">
            {stats.eliminated}
          </p>
        </Card>
        <Card className="p-4">
          <p className="label">In Progress</p>
          <p className="mt-1 text-2xl font-semibold tabular">{stats.inProgress}</p>
        </Card>
        <Card className="p-4">
          <p className="label">Shortlisted</p>
          <p className="mt-1 text-2xl font-semibold tabular text-primary">
            {stats.shortlisted}
          </p>
        </Card>
      </div>

      {/* Roster Controls */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Participant Roster</CardTitle>
              <CardDescription>
                Review submissions, inspect strike logs, and shortlist candidates.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { id: "all", label: "All" },
              { id: "shortlisted", label: `Shortlisted (${stats.shortlisted})` },
              { id: "submitted", label: `Submitted (${stats.submitted})` },
              { id: "deadline", label: `Deadline (${stats.deadline})` },
              { id: "eliminated", label: `Eliminated (${stats.eliminated})` },
              { id: "in_progress", label: `In Progress (${stats.inProgress})` },
            ].map((f) => (
              <Button
                key={f.id}
                variant={statusFilter === f.id ? "default" : "outline"}
                size="xs"
                onClick={() => setStatusFilter(f.id)}
                className="transition-colors duration-150 ease-out active:scale-[0.98]"
              >
                {f.label}
              </Button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">Shortlist</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Locked Out</TableHead>
                <TableHead>Lockout Reason</TableHead>
                <TableHead>Elapsed</TableHead>
                <TableHead className="text-center">Strikes</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParticipants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    No participants match your filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredParticipants.map((p) => {
                  const isSelected = selectedDetail?.participant.id === p.id;

                  return (
                    <TableRow
                      key={p.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer transition-colors duration-150 ease-out"
                      onClick={() => handleSelectParticipant(p)}
                    >
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant={p.shortlisted ? "default" : "ghost"}
                          size="icon-xs"
                          title={
                            p.shortlisted
                              ? "Remove from shortlist"
                              : "Mark as shortlisted"
                          }
                          aria-label={
                            p.shortlisted
                              ? "Remove from shortlist"
                              : "Mark as shortlisted"
                          }
                          onClick={(e) => handleToggleShortlist(p.id, e)}
                          className="transition-transform duration-150 ease-out active:scale-[0.97]"
                        >
                          {p.shortlisted ? (
                            <BookmarkCheck className="size-3.5 text-primary-foreground" />
                          ) : (
                            <Bookmark className="size-3.5 text-muted-foreground hover:text-foreground" />
                          )}
                        </Button>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {p.displayName}
                          </span>
                          <span className="text-xs text-muted-foreground mono">
                            {p.email}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {p.status === "locked_out" ? (
                          <Badge variant="secondary">Locked out</Badge>
                        ) : p.status === "solving" ? (
                          <Badge variant="outline" className="border-blue-500/40 text-blue-400">
                            Solving
                          </Badge>
                        ) : (
                          <Badge variant="outline">Joined</Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground mono">
                        {formatTimestamp(p.joinedAt)}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground mono">
                        {formatTimestamp(p.lockedAt)}
                      </TableCell>

                      <TableCell>
                        {p.lockoutReason === "submitted" ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                            Submitted
                          </Badge>
                        ) : p.lockoutReason === "deadline" ? (
                          <Badge variant="outline">Deadline</Badge>
                        ) : p.lockoutReason === "eliminated" ? (
                          <Badge variant="destructive">Eliminated</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>

                      <TableCell className="mono tabular text-sm">
                        {p.elapsedSeconds != null
                          ? formatDuration(p.elapsedSeconds)
                          : "—"}
                      </TableCell>

                      <TableCell className="text-center">
                        <span
                          className={`mono tabular font-medium text-xs px-2 py-0.5 rounded ${
                            p.strikes >= 3
                              ? "bg-destructive/20 text-destructive"
                              : p.strikes > 0
                                ? "bg-amber-500/20 text-amber-300"
                                : "text-muted-foreground"
                          }`}
                        >
                          {p.strikes}
                        </span>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant={isSelected ? "secondary" : "outline"}
                          size="xs"
                          className="transition-transform duration-150 ease-out active:scale-[0.97]"
                        >
                          {isSelected ? "Inspecting" : "Review"}
                          <ArrowRight data-icon="inline-end" className="size-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected Participant Review Section */}
      <div id="submission-viewer">
        {isLoadingSubmission ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Clock className="size-6 animate-spin" />
              <p className="text-sm">Loading participant submission...</p>
            </div>
          </Card>
        ) : selectedDetail ? (
          <ParticipantReviewPanel
            detail={selectedDetail}
            eventId={eventId}
            onClose={() => setSelectedDetail(null)}
            onToggleShortlist={() =>
              handleToggleShortlist(selectedDetail.participant.id)
            }
          />
        ) : null}
      </div>
    </div>
  );
}

type RerunState = {
  isRunning?: boolean;
  result?: RunResult;
  error?: string;
};

export function ParticipantReviewPanel({
  detail,
  eventId,
  onClose,
  onToggleShortlist,
}: {
  detail: ParticipantSubmissionDetail;
  eventId: string;
  onClose: () => void;
  onToggleShortlist: () => void;
}) {
  const { participant, snippets, violations } = detail;
  const isLocked = participant.status === "locked_out";
  const defaultTab = snippets[0]?.problemId ?? "";

  const [rerunStates, setRerunStates] = useState<Record<string, RerunState>>({});

  async function handleRerun(problemId: string) {
    setRerunStates((prev) => ({
      ...prev,
      [problemId]: { isRunning: true, result: undefined, error: undefined },
    }));

    const res = await rerunSubmissionAction(eventId, participant.id, problemId);

    if ("error" in res) {
      setRerunStates((prev) => ({
        ...prev,
        [problemId]: { isRunning: false, error: res.error },
      }));
      toast.error(res.error);
    } else {
      setRerunStates((prev) => ({
        ...prev,
        [problemId]: { isRunning: false, result: res.result },
      }));
      toast.success("Ran submitted code against sample test cases");
    }
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-xl">{participant.displayName}</CardTitle>
              {participant.status === "locked_out" ? (
                <Badge variant="secondary">Locked out</Badge>
              ) : (
                <Badge variant="outline">{participant.status}</Badge>
              )}
              {participant.lockoutReason ? (
                <Badge
                  variant={
                    participant.lockoutReason === "submitted"
                      ? "outline"
                      : participant.lockoutReason === "eliminated"
                        ? "destructive"
                        : "secondary"
                  }
                  className={
                    participant.lockoutReason === "submitted"
                      ? "border-emerald-500/40 text-emerald-400"
                      : ""
                  }
                >
                  {REASON_LABELS[participant.lockoutReason] ??
                    participant.lockoutReason}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm mono text-muted-foreground">{participant.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={participant.shortlisted ? "default" : "outline"}
              size="sm"
              onClick={onToggleShortlist}
              className="transition-transform duration-150 ease-out active:scale-[0.98]"
            >
              {participant.shortlisted ? (
                <BookmarkCheck data-icon="inline-start" className="size-4" />
              ) : (
                <Bookmark data-icon="inline-start" className="size-4" />
              )}
              {participant.shortlisted ? "Shortlisted" : "Shortlist"}
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close review panel"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <dl className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border/40 pt-3">
          <div className="flex items-baseline gap-2">
            <dt className="label">Joined</dt>
            <dd className="mono text-xs text-muted-foreground">
              {formatFullDate(participant.joinedAt)}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="label">Locked at</dt>
            <dd className="mono text-xs text-muted-foreground">
              {formatFullDate(participant.lockedAt)}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="label">Elapsed</dt>
            <dd className="tabular text-sm font-medium">
              {participant.elapsedSeconds != null
                ? formatDuration(participant.elapsedSeconds)
                : "—"}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="label">Strikes</dt>
            <dd className="tabular text-sm font-medium">
              {participant.strikes}
            </dd>
          </div>
        </dl>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Code Section */}
        <div>
          <h3 className="text-sm font-semibold tracking-tight mb-3 flex items-center gap-2">
            <Code2 className="size-4 text-muted-foreground" />
            Submitted Code
          </h3>

          {!isLocked ? (
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>Submission not available</AlertTitle>
              <AlertDescription>
                This participant is currently {participant.status} and has not
                been locked out yet. Live in-progress code is private and will
                only appear here after submission, deadline, or elimination.
              </AlertDescription>
            </Alert>
          ) : snippets.length === 0 ? (
            <Alert>
              <AlertTitle>No code found</AlertTitle>
              <AlertDescription>
                No problem snippets were saved for this participant.
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto">
                {snippets.map((snip) => (
                  <TabsTrigger
                    key={snip.problemId}
                    value={snip.problemId}
                    className="flex items-center gap-2"
                  >
                    <span>
                      Problem {snip.position}: {snip.problemTitle}
                    </span>
                    {snip.language ? (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 uppercase">
                        {snip.language}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">(empty)</span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {snippets.map((snip) => {
                const state = rerunStates[snip.problemId] ?? {};
                const hasCode = Boolean(snip.code && snip.language);

                return (
                  <TabsContent
                    key={snip.problemId}
                    value={snip.problemId}
                    className="mt-3 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="label">Language:</span>
                        <span className="font-medium text-foreground uppercase mono">
                          {snip.language ?? "None"}
                        </span>
                      </div>
                      {snip.code ? (
                        <span className="mono tabular">
                          {snip.code.split("\n").length} lines
                        </span>
                      ) : null}
                    </div>

                    {hasCode ? (
                      <>
                        <ReviewCodeEditor
                          code={snip.code!}
                          language={snip.language ?? "python"}
                          problemId={snip.problemId}
                        />

                        {/* Re-run section */}
                        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold tracking-tight text-foreground">
                                  Re-run against sample test cases
                                </span>
                                <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase">
                                  Reading aid
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Reading aid &mdash; runs code against sample test cases and produces no verdict or score.
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={state.isRunning}
                              onClick={() => handleRerun(snip.problemId)}
                              className="transition-transform duration-150 ease-out active:scale-[0.98]"
                            >
                              {state.isRunning ? (
                                <>
                                  <Loader2 data-icon="inline-start" className="size-3.5 animate-spin" />
                                  Running...
                                </>
                              ) : (
                                <>
                                  <Play data-icon="inline-start" className="size-3.5" />
                                  Run submitted code
                                </>
                              )}
                            </Button>
                          </div>

                          {state.error ? (
                            <Alert variant="destructive">
                              <AlertTriangle className="size-4" />
                              <AlertTitle>Run failed</AlertTitle>
                              <AlertDescription className="text-xs break-words">
                                {state.error}
                              </AlertDescription>
                            </Alert>
                          ) : null}

                          {state.result ? (
                            <div className="mt-2 border-t border-border/40 pt-3">
                              <RunResultView result={state.result} />
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
                        No code submitted for this problem.
                      </div>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>

        <Separator />

        {/* Strike & Violation Log */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <ShieldAlert className="size-4 text-muted-foreground" />
              Strike & Violation Log
            </h3>
            <span className="text-xs text-muted-foreground tabular">
              {violations.length} recorded event{violations.length === 1 ? "" : "s"}
            </span>
          </div>

          {violations.length === 0 ? (
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              No strikes or violations recorded against this participant.
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="w-36 text-right">Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="mono text-xs text-muted-foreground">
                        {formatFullDate(v.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {VIOLATION_LABELS[v.kind] ?? v.kind}
                      </TableCell>
                      <TableCell className="text-right">
                        {v.counted ? (
                          <Badge variant="destructive">Strike (counted)</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Blocked (uncounted)
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
