import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { isOrganizerEmail } from "@/lib/env";
import type { EventSummary } from "./queries";

/** The acting account. Domain modules never read the session themselves. */
export type EventActor = {
  id: string;
  email: string;
};

export type CreateEventInput = {
  title: string;
  durationMinutes: number;
};

/** Tests inject a deterministic generator to force a collision. */
export type JoinCodeOptions = {
  generateCode?: () => string;
};

const JOIN_CODE_LENGTH = 6;
const JOIN_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const JOIN_CODE_ATTEMPTS = 20;

export function generateJoinCode(): string {
  let code = "";
  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export function assertOrganizer(actor: EventActor, action: string): void {
  if (!isOrganizerEmail(actor.email)) {
    throw new DomainError(
      "not_organizer",
      `Only an organizer can ${action}.`,
      403,
    );
  }
}

function validateTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new DomainError("title_required", "Give the event a title.");
  }
  return trimmed;
}

function validateDuration(durationMinutes: number): number {
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new DomainError(
      "duration_invalid",
      "Duration must be a whole number of minutes greater than zero.",
    );
  }
  return durationMinutes;
}

/** Drizzle wraps driver errors, so walk the cause chain for Postgres 23505. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

/**
 * A join code is unique among non-ended events, so a fresh insert or update can
 * lose a race. Retry with a new code rather than surfacing a constraint error.
 */
async function withFreshJoinCode<T>(
  generateCode: () => string,
  attempt: (code: string) => Promise<T>,
  shouldSkip: (code: string) => boolean = () => false,
): Promise<T> {
  for (let tries = 0; tries < JOIN_CODE_ATTEMPTS; tries += 1) {
    const code = generateCode();
    if (shouldSkip(code)) continue;
    try {
      return await attempt(code);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new DomainError(
    "join_code_unavailable",
    "Could not allocate a join code. Try again.",
    503,
  );
}

/**
 * Creates a draft event owned by the acting organizer.
 */
export async function createEvent(
  actor: EventActor,
  input: CreateEventInput,
  options: JoinCodeOptions = {},
): Promise<EventSummary> {
  assertOrganizer(actor, "create an event");
  const title = validateTitle(input.title);
  const durationMinutes = validateDuration(input.durationMinutes);
  const generateCode = options.generateCode ?? generateJoinCode;

  return withFreshJoinCode(generateCode, async (code) => {
    const [row] = await getDb()
      .insert(events)
      .values({
        title,
        code,
        status: "draft",
        durationMinutes,
        createdBy: actor.id,
      })
      .returning({
        id: events.id,
        title: events.title,
        status: events.status,
        durationMinutes: events.durationMinutes,
        code: events.code,
        startsAt: events.startsAt,
        deadlineAt: events.deadlineAt,
        endedAt: events.endedAt,
      });
    return row;
  });
}

/**
 * Replaces the join code of a draft event. The old code stops resolving as soon
 * as the row is updated; live and ended events keep the code they were given.
 */
export async function regenerateJoinCode(
  actor: EventActor,
  eventId: string,
  options: JoinCodeOptions = {},
): Promise<EventSummary> {
  assertOrganizer(actor, "change a join code");

  const [current] = await getDb()
    .select({ id: events.id, code: events.code, status: events.status })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.createdBy, actor.id)))
    .limit(1);

  if (!current) {
    throw new DomainError("event_not_found", "Event not found.", 404);
  }
  if (current.status !== "draft") {
    throw new DomainError(
      "event_not_draft",
      "The join code can only be regenerated while the event is a draft.",
    );
  }

  const generateCode = options.generateCode ?? generateJoinCode;

  return withFreshJoinCode(
    generateCode,
    async (code) => {
      const [row] = await getDb()
        .update(events)
        .set({ code })
        .where(
          and(
            eq(events.id, eventId),
            eq(events.createdBy, actor.id),
            eq(events.status, "draft"),
          ),
        )
        .returning({
          id: events.id,
          title: events.title,
          status: events.status,
          durationMinutes: events.durationMinutes,
          code: events.code,
          startsAt: events.startsAt,
          deadlineAt: events.deadlineAt,
          endedAt: events.endedAt,
        });

      if (!row) {
        throw new DomainError(
          "event_not_draft",
          "The join code can only be regenerated while the event is a draft.",
        );
      }
      return row;
    },
    (code) => code === current.code,
  );
}
