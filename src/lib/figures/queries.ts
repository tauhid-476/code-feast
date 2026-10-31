import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  events,
  participants,
  problemFigures,
  problems,
} from "@/lib/db/schema";
import { isApprovedOrganizer } from "@/lib/organizers/whitelist";
import {
  type Figure,
  type FigureActor,
  type FigureContentType,
  type FigureState,
  type FigureView,
  toFigureView,
} from "./types";

/** Figure reads. The row is the authorization record; bytes live in storage. */

const figureColumns = {
  id: problemFigures.id,
  problemId: problemFigures.problemId,
  storageKey: problemFigures.storageKey,
  contentType: problemFigures.contentType,
  bytes: problemFigures.bytes,
  width: problemFigures.width,
  height: problemFigures.height,
  state: problemFigures.state,
  createdAt: problemFigures.createdAt,
};

type FigureRow = {
  id: string;
  problemId: string;
  storageKey: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  state: string;
  createdAt: Date;
};

function toFigure(row: FigureRow): Figure {
  return {
    ...row,
    contentType: row.contentType as FigureContentType,
    state: row.state as FigureState,
  };
}

export async function getFigure(figureId: string): Promise<Figure | null> {
  const [row] = await getDb()
    .select(figureColumns)
    .from(problemFigures)
    .where(eq(problemFigures.id, figureId))
    .limit(1);
  return row ? toFigure(row) : null;
}

/** Every Figure of a Problem, including a pending upload. Authoring only. */
export async function listFigures(problemId: string): Promise<Figure[]> {
  const rows = await getDb()
    .select(figureColumns)
    .from(problemFigures)
    .where(eq(problemFigures.problemId, problemId))
    .orderBy(asc(problemFigures.createdAt));
  return rows.map(toFigure);
}

/**
 * Ready Figure metadata for a set of Problems, keyed by problem id. This is the
 * renderer-facing projection: no storage key, no bytes, and pending rows never
 * appear in a statement.
 */
export async function listReadyFigureViews(
  problemIds: string[],
): Promise<Map<string, FigureView[]>> {
  if (problemIds.length === 0) return new Map();

  const rows = await getDb()
    .select({
      id: problemFigures.id,
      problemId: problemFigures.problemId,
      width: problemFigures.width,
      height: problemFigures.height,
    })
    .from(problemFigures)
    .where(
      and(
        inArray(problemFigures.problemId, problemIds),
        eq(problemFigures.state, "ready"),
      ),
    )
    .orderBy(asc(problemFigures.createdAt));

  const byProblem = new Map<string, FigureView[]>();
  for (const row of rows) {
    const list = byProblem.get(row.problemId) ?? [];
    list.push({ id: row.id, width: row.width, height: row.height });
    byProblem.set(row.problemId, list);
  }
  return byProblem;
}

/**
 * The read matrix (ticket 20): the Organizer who owns the Event always; a
 * joined Participant only while the Event is `live` or `ended`; everyone else
 * gets null, which the route answers with 404. Before Start the Lobby rule
 * applies to the pixels too.
 */
export async function canReadFigure(
  actor: FigureActor | null,
  figureId: string,
): Promise<Figure | null> {
  if (!actor) return null;

  const [row] = await getDb()
    .select({
      figure: figureColumns,
      eventId: events.id,
      eventStatus: events.status,
      createdBy: events.createdBy,
    })
    .from(problemFigures)
    .innerJoin(problems, eq(problemFigures.problemId, problems.id))
    .innerJoin(events, eq(problems.eventId, events.id))
    .where(eq(problemFigures.id, figureId))
    .limit(1);

  if (!row || row.figure.state !== "ready") return null;

  if (
    row.createdBy === actor.id &&
    (await isApprovedOrganizer(actor.email))
  ) {
    return toFigure(row.figure);
  }

  if (row.eventStatus !== "live" && row.eventStatus !== "ended") return null;

  const [joined] = await getDb()
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.eventId, row.eventId),
        eq(participants.userId, actor.id),
      ),
    )
    .limit(1);

  return joined ? toFigure(row.figure) : null;
}

export { toFigureView };
