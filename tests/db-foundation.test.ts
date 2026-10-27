import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, useCleanDatabase } from "./helpers/db";
import { insertEvent, insertProblem } from "./helpers/factories";

useCleanDatabase();

describe("database foundation", () => {
  it("has the events table wired through the data layer", async () => {
    const event = await insertEvent({ title: "Smoke", code: "SMOKE1" });

    const [row] = await db.execute<{ title: string; status: string }>(
      sql`select title, status from events where id = ${event.id}`,
    ).then((result) => result.rows);

    expect(row).toEqual({ title: "Smoke", status: "draft" });
  });

  it("cascades problems when an event is deleted", async () => {
    const event = await insertEvent();
    await insertProblem(event.id);

    await db.execute(sql`delete from events where id = ${event.id}`);

    const result = await db.execute<{ count: string }>(
      sql`select count(*)::text as count from problems`,
    );
    expect(result.rows[0].count).toBe("0");
  });

  it("rejects a second non-ended event with the same join code", async () => {
    await insertEvent({ code: "DUP123" });

    await expect(insertEvent({ code: "DUP123" })).rejects.toThrow();
  });

  it("allows an ended event to reuse a join code", async () => {
    await insertEvent({ code: "DUP123", status: "ended" });
    const second = await insertEvent({ code: "DUP123" });
    expect(second.code).toBe("DUP123");
  });
});
