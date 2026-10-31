import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb, type Transaction } from "@/lib/db/client";
import { events, problemFigures, problems } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isApprovedOrganizer } from "@/lib/organizers/whitelist";
import { now as serverNow } from "@/lib/time";
import {
  defaultFigureStorage,
  type FigureStorage,
} from "./storage";
import {
  figureExtension,
  isFigureContentType,
  MAX_FIGURE_BYTES,
  MAX_FIGURES_PER_PROBLEM,
  type Figure,
  type FigureActor,
  type FigureContentType,
  type FigureState,
} from "./types";

/**
 * Figure lifecycle. Every function takes the acting account and plain inputs;
 * nothing here reads cookies, headers, or redirects (architecture rule 1).
 */

export type FigureOptions = {
  /** Tests inject an in-memory store; production falls back to the bucket. */
  storage?: FigureStorage | null;
  /** Tests move the clock; the app never passes this. */
  now?: Date;
};

export type MintFigureInput = {
  problemId: string;
  contentType: string;
  bytes: number;
  /** Reported by the browser; null when it could not measure the picture. */
  width?: number | null;
  height?: number | null;
};

export type MintedFigure = {
  id: string;
  /** The bucket endpoint the browser POSTs the form to. */
  url: string;
  fields: Record<string, string>;
};

export type ReconcileResult = {
  deleted: number;
};

const STALE_PENDING_AFTER_MS = 24 * 60 * 60 * 1000;
const STALE_PENDING_SWEEP_LIMIT = 20;

/**
 * Any `/api/figures/<id>` mention is a reference, whether it is an image or a
 * plain link. A malformed id is not silently ignored: saving refuses it below.
 */
const FIGURE_REFERENCE = /\/api\/figures\/([^\s)"'<>]+)/g;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function referencedFigureIds(statementMd: string): string[] {
  const ids = new Set<string>();
  for (const match of statementMd.matchAll(FIGURE_REFERENCE)) {
    ids.add(match[1]);
  }
  return [...ids];
}

async function assertOrganizer(
  actor: FigureActor,
  action: string,
): Promise<void> {
  if (!(await isApprovedOrganizer(actor.email))) {
    throw new DomainError(
      "not_organizer",
      `Only an organizer can ${action}.`,
      403,
    );
  }
}

async function lockDraftEvent(
  tx: Transaction,
  eventId: string,
): Promise<void> {
  const [row] = await tx
    .select({ status: events.status })
    .from(events)
    .where(eq(events.id, eventId))
    .for("update")
    .limit(1);

  if (!row) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }
  if (row.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }
}

/**
 * Resolves a Problem the actor may author, joining its Event so ownership and
 * draft status are checked in the same read.
 */
async function requireDraftProblem(
  actor: FigureActor,
  problemId: string,
): Promise<{ eventId: string }> {
  const [row] = await getDb()
    .select({ eventId: problems.eventId, status: events.status })
    .from(problems)
    .innerJoin(events, eq(problems.eventId, events.id))
    .where(and(eq(problems.id, problemId), eq(events.createdBy, actor.id)))
    .limit(1);

  if (!row) {
    throw new DomainError("problem_not_found", "Problem not found.", 404);
  }
  if (row.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }
  return { eventId: row.eventId };
}

function requireStorage(options: FigureOptions): FigureStorage {
  const storage =
    options.storage === undefined ? defaultFigureStorage() : options.storage;
  if (!storage) {
    throw new DomainError(
      "storage_unavailable",
      "Figure storage is not configured on this deployment.",
      503,
    );
  }
  return storage;
}

function dimension(value: number | null | undefined): number | null {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : null;
}

function validateContentType(value: string): FigureContentType {
  if (!isFigureContentType(value)) {
    throw new DomainError(
      "figure_type_invalid",
      "A Figure can only be a PNG, JPEG or WebP image.",
    );
  }
  return value;
}

function validateBytes(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_FIGURE_BYTES
  ) {
    throw new DomainError(
      "figure_too_large",
      "A Figure can be at most 2MB.",
    );
  }
  return value;
}

/**
 * Removes the objects behind rows that have already been deleted. Best effort:
 * the statement save is already committed, and a failed delete must not make
 * the save look failed.
 */
export async function removeFigureObjects(
  storageKeys: string[],
  storage?: FigureStorage | null,
): Promise<void> {
  if (storageKeys.length === 0) return;
  const active =
    storage === undefined ? defaultFigureStorage() : storage;
  if (!active) return;

  await Promise.all(
    storageKeys.map((key) =>
      active.remove(key).catch((error) => {
        console.error(`[figures] could not remove ${key}`, error);
      }),
    ),
  );
}

/**
 * Validates a statement's Figure references and deletes every Figure of the
 * Problem it no longer mentions. Returns the storage keys to remove after the
 * transaction commits.
 *
 * A reference to an unknown or pending Figure refuses the save: a broken
 * picture never reaches a participant.
 */
export async function reconcileFiguresInTransaction(
  tx: Transaction,
  problemId: string,
  statementMd: string,
): Promise<string[]> {
  const referenced = referencedFigureIds(statementMd);
  for (const id of referenced) {
    if (!UUID.test(id)) {
      throw new DomainError(
        "figure_not_ready",
        "The statement references a figure that does not exist. Remove it or upload it again.",
      );
    }
  }

  const rows = await tx
    .select({
      id: problemFigures.id,
      storageKey: problemFigures.storageKey,
      state: problemFigures.state,
    })
    .from(problemFigures)
    .where(eq(problemFigures.problemId, problemId));

  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const id of referenced) {
    const row = byId.get(id);
    if (!row || row.state !== "ready") {
      throw new DomainError(
        "figure_not_ready",
        "The statement references a figure that is not ready. Upload it again, then save.",
      );
    }
  }

  const keep = new Set(referenced);
  const removed = rows.filter((row) => !keep.has(row.id));
  if (removed.length === 0) return [];

  await tx
    .delete(problemFigures)
    .where(
      inArray(
        problemFigures.id,
        removed.map((row) => row.id),
      ),
    );

  return removed.map((row) => row.storageKey);
}

/**
 * The public reconciliation: the Organizer's explicit Save is the confirmation
 * that a removed Figure is gone for good.
 */
export async function reconcileFigures(
  actor: FigureActor,
  problemId: string,
  statementMd: string,
  options: FigureOptions = {},
): Promise<ReconcileResult> {
  await assertOrganizer(actor, "edit a problem");
  const { eventId } = await requireDraftProblem(actor, problemId);

  const removedKeys = await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);
    return reconcileFiguresInTransaction(tx, problemId, statementMd);
  });

  await removeFigureObjects(removedKeys, options.storage);
  return { deleted: removedKeys.length };
}

/**
 * Mints an upload: sweeps nothing itself (the route dispatches the sweep off
 * the response), enforces the six-Figure cap, inserts a `pending` row, and
 * returns a presigned POST pinned to that exact key.
 */
export async function mintFigure(
  actor: FigureActor,
  input: MintFigureInput,
  options: FigureOptions = {},
): Promise<MintedFigure> {
  await assertOrganizer(actor, "add a figure");

  const contentType = validateContentType(input.contentType);
  const bytes = validateBytes(input.bytes);
  const storage = requireStorage(options);
  const { eventId } = await requireDraftProblem(actor, input.problemId);

  const id = randomUUID();
  const storageKey = `problems/${input.problemId}/${id}.${figureExtension(
    contentType,
  )}`;

  await getDb().transaction(async (tx) => {
    await lockDraftEvent(tx, eventId);

    const [aggregate] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(problemFigures)
      .where(eq(problemFigures.problemId, input.problemId));

    if ((aggregate?.count ?? 0) >= MAX_FIGURES_PER_PROBLEM) {
      throw new DomainError(
        "figure_limit_reached",
        `A problem can hold at most ${MAX_FIGURES_PER_PROBLEM} figures. Remove one from the statement and save before adding another.`,
      );
    }

    await tx.insert(problemFigures).values({
      id,
      problemId: input.problemId,
      storageKey,
      contentType,
      bytes,
      width: dimension(input.width),
      height: dimension(input.height),
      state: "pending",
    });
  });

  try {
    const presigned = await storage.presignPost({
      key: storageKey,
      contentType,
      bytes,
    });
    return { id, url: presigned.url, fields: presigned.fields };
  } catch (error) {
    // No upload can happen without a presigned POST; do not leave a row that
    // would count against the cap for 24 hours.
    await getDb()
      .delete(problemFigures)
      .where(eq(problemFigures.id, id))
      .catch(() => undefined);
    console.error("[figures] could not presign upload", error);
    throw new DomainError(
      "storage_unavailable",
      "Figure storage could not be reached. Try again in a moment.",
      503,
    );
  }
}

/**
 * Confirms that the object exists and matches what was minted, then makes the
 * Figure referenceable. A missing or mismatched object deletes the row at once
 * rather than waiting for the sweep.
 */
export async function confirmFigure(
  actor: FigureActor,
  figureId: string,
  options: FigureOptions = {},
): Promise<Figure> {
  await assertOrganizer(actor, "confirm a figure upload");
  const storage = requireStorage(options);

  const [row] = await getDb()
    .select({
      id: problemFigures.id,
      problemId: problemFigures.problemId,
      storageKey: problemFigures.storageKey,
      contentType: problemFigures.contentType,
      bytes: problemFigures.bytes,
      width: problemFigures.width,
      height: problemFigures.height,
      state: problemFigures.state,
      createdAt: problemFigures.createdAt,
      eventId: problems.eventId,
      eventStatus: events.status,
    })
    .from(problemFigures)
    .innerJoin(problems, eq(problemFigures.problemId, problems.id))
    .innerJoin(events, eq(problems.eventId, events.id))
    .where(
      and(eq(problemFigures.id, figureId), eq(events.createdBy, actor.id)),
    )
    .limit(1);

  if (!row) {
    throw new DomainError("figure_not_found", "Figure not found.", 404);
  }
  if (row.eventStatus !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "Problems can only be edited while the event is a draft.",
    );
  }

  const figure: Figure = {
    id: row.id,
    problemId: row.problemId,
    storageKey: row.storageKey,
    contentType: row.contentType as FigureContentType,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    state: row.state as FigureState,
    createdAt: row.createdAt,
  };

  if (figure.state === "ready") return figure;

  const head = await storage.head(figure.storageKey);
  if (!head) {
    await getDb()
      .delete(problemFigures)
      .where(eq(problemFigures.id, figureId));
    throw new DomainError(
      "figure_not_found",
      "The upload did not arrive. Add the figure again.",
      404,
    );
  }

  if (head.contentType !== figure.contentType) {
    await getDb()
      .delete(problemFigures)
      .where(eq(problemFigures.id, figureId));
    throw new DomainError(
      "figure_type_invalid",
      "The uploaded file was not the image that was expected. Add it again.",
    );
  }

  if (head.bytes < 1 || head.bytes > MAX_FIGURE_BYTES) {
    await getDb()
      .delete(problemFigures)
      .where(eq(problemFigures.id, figureId));
    throw new DomainError("figure_too_large", "A Figure can be at most 2MB.");
  }

  const updated = await getDb().transaction(async (tx) => {
    // A save or Start could have landed between the read and the HEAD.
    await lockDraftEvent(tx, row.eventId);
    const [next] = await tx
      .update(problemFigures)
      .set({ state: "ready", bytes: head.bytes })
      .where(eq(problemFigures.id, figureId))
      .returning({
        id: problemFigures.id,
        problemId: problemFigures.problemId,
        storageKey: problemFigures.storageKey,
        contentType: problemFigures.contentType,
        bytes: problemFigures.bytes,
        width: problemFigures.width,
        height: problemFigures.height,
        state: problemFigures.state,
        createdAt: problemFigures.createdAt,
      });
    return next;
  });

  if (!updated) {
    throw new DomainError("figure_not_found", "Figure not found.", 404);
  }

  return {
    ...updated,
    contentType: updated.contentType as FigureContentType,
    state: updated.state as FigureState,
  };
}

/**
 * Deletes at most 20 abandoned `pending` rows older than 24 hours and their
 * objects. Dispatched with `after()` so it never delays a mint.
 */
export async function sweepStalePending(
  options: FigureOptions = {},
): Promise<number> {
  const at = options.now ?? serverNow();
  const cutoff = new Date(at.getTime() - STALE_PENDING_AFTER_MS);

  const candidates = await getDb()
    .select({ id: problemFigures.id })
    .from(problemFigures)
    .where(
      and(
        eq(problemFigures.state, "pending"),
        lt(problemFigures.createdAt, cutoff),
      ),
    )
    .orderBy(asc(problemFigures.createdAt))
    .limit(STALE_PENDING_SWEEP_LIMIT);

  if (candidates.length === 0) return 0;

  // `state = 'pending'` again so a row confirmed in between is not deleted.
  const deleted = await getDb()
    .delete(problemFigures)
    .where(
      and(
        inArray(
          problemFigures.id,
          candidates.map((row) => row.id),
        ),
        eq(problemFigures.state, "pending"),
      ),
    )
    .returning({ storageKey: problemFigures.storageKey });

  await removeFigureObjects(
    deleted.map((row) => row.storageKey),
    options.storage,
  );

  return deleted.length;
}
