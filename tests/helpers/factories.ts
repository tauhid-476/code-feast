import { randomUUID } from "node:crypto";
import { db } from "./db";
import {
  events,
  participants,
  problemStarters,
  problems,
  testCases,
} from "@/lib/db/schema";

/**
 * Fixtures write rows directly. They are setup, not assertions: tests still
 * exercise behaviour through the domain modules.
 */

/** Drops undefined keys so a partial override never erases a default. */
function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export type TestUser = {
  id: string;
  email: string;
  name: string;
};

export function testUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${id.slice(0, 8)}@example.com`;
  return {
    id,
    email,
    name: overrides.name ?? email.split("@")[0],
  };
}

export async function insertEvent(
  overrides: Partial<typeof events.$inferInsert> = {},
): Promise<typeof events.$inferSelect> {
  const [row] = await db
    .insert(events)
    .values({
      title: "Friday Night Contest",
      code: "ABC123",
      status: "draft",
      durationMinutes: 90,
      createdBy: randomUUID(),
      ...compact(overrides),
    })
    .returning();
  return row;
}

export async function insertParticipant(
  eventId: string,
  user: TestUser,
  overrides: Partial<typeof participants.$inferInsert> = {},
): Promise<typeof participants.$inferSelect> {
  const [row] = await db
    .insert(participants)
    .values({
      eventId,
      userId: user.id,
      displayName: user.name,
      email: user.email,
      ...compact(overrides),
    })
    .returning();
  return row;
}

export async function insertProblem(
  eventId: string,
  overrides: Partial<typeof problems.$inferInsert> = {},
): Promise<typeof problems.$inferSelect> {
  const [row] = await db
    .insert(problems)
    .values({
      eventId,
      position: 1,
      title: "Two Sum",
      statementMd: "Find two numbers that add up.",
      ...compact(overrides),
    })
    .returning();
  return row;
}

export async function insertStarter(
  problemId: string,
  language: "python" | "java" | "cpp",
  starterCode = "def solve():\n    pass\n",
  harnessCode = "print(solve())\n",
): Promise<typeof problemStarters.$inferSelect> {
  const [row] = await db
    .insert(problemStarters)
    .values({ problemId, language, starterCode, harnessCode })
    .returning();
  return row;
}

export async function insertTestCase(
  problemId: string,
  position: 1 | 2,
  input = "1 2\n",
  expectedOutput = "3\n",
): Promise<typeof testCases.$inferSelect> {
  const [row] = await db
    .insert(testCases)
    .values({ problemId, position, input, expectedOutput })
    .returning();
  return row;
}
