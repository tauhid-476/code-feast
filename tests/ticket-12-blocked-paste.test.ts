import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { participants, violations } from "@/lib/db/schema";
import { addMinutes } from "@/lib/time";
import { loadParticipantContext } from "@/lib/participants/queries";
import {
  blockedKindFor,
  blockedMessage,
  PASTE_BLOCKED_MESSAGE,
  shouldReportAttempt,
} from "@/lib/contest/anti-cheat";
import { installEditorGuards } from "@/components/editor-guards";
import { logViolation } from "@/lib/violations/log";
import type { ViolationKind } from "@/lib/violations/kinds";
import { db, useCleanDatabase } from "./helpers/db";
import {
  insertEvent,
  insertParticipant,
  testUser,
} from "./helpers/factories";

useCleanDatabase();

const solver = testUser({ email: "solver@example.com", name: "Sam Solver" });
const startsAt = new Date("2026-10-28T18:00:00.000Z");
const deadlineAt = addMinutes(startsAt, 90);
const inContest = addMinutes(startsAt, 30);

async function contest(code: string) {
  const event = await insertEvent({
    code,
    status: "live",
    durationMinutes: 90,
    startsAt,
    deadlineAt,
  });
  const participant = await insertParticipant(event.id, solver, {
    status: "solving",
    joinedAt: startsAt,
  });
  const context = await loadParticipantContext(code, solver.id, {
    now: inContest,
  });
  return { event, participant, context };
}

async function participantRow(participantId: string) {
  const [row] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, participantId));
  return row;
}

async function loggedViolations(participantId: string) {
  return db
    .select()
    .from(violations)
    .where(eq(violations.participantId, participantId));
}

describe("blocked attempts are recorded and cost nothing", () => {
  it("logs a blocked paste as uncounted and leaves the strike count alone", async () => {
    const { participant, context } = await contest("PASTE01");
    const attemptAt = addMinutes(startsAt, 31);

    await logViolation(context, { kind: "paste_blocked" }, { now: attemptAt });

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      participantId: participant.id,
      kind: "paste_blocked",
      counted: false,
      createdAt: attemptAt,
    });
    expect((await participantRow(participant.id)).strikes).toBe(0);
  });

  it("never increments strikes, however many attempts there are", async () => {
    const { participant, context } = await contest("PASTE02");

    const kinds: ViolationKind[] = [
      "paste_blocked",
      "paste_blocked",
      "context_menu_blocked",
      "paste_blocked",
      "context_menu_blocked",
    ];
    for (const [index, kind] of kinds.entries()) {
      await logViolation(context, { kind }, {
        now: new Date(inContest.getTime() + index * 1_000),
      });
    }

    const rows = await loggedViolations(participant.id);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.counted === false)).toBe(true);
    expect(
      rows.map((row) => row.kind).sort(),
    ).toEqual([
      "context_menu_blocked",
      "context_menu_blocked",
      "paste_blocked",
      "paste_blocked",
      "paste_blocked",
    ]);

    expect(await participantRow(participant.id)).toMatchObject({
      status: "solving",
      strikes: 0,
      lockedAt: null,
    });
  });

  it("keeps the record across a refresh", async () => {
    const { participant, context } = await contest("PASTE03");
    await logViolation(context, { kind: "paste_blocked" }, {
      now: addMinutes(startsAt, 31),
    });

    // A fresh page load is another context and another query; the row is the
    // server's, not the tab's.
    const afterRefresh = await loadParticipantContext("PASTE03", solver.id, {
      now: addMinutes(startsAt, 32),
    });
    expect(afterRefresh?.participant?.strikes).toBe(0);
    expect(await loggedViolations(participant.id)).toHaveLength(1);
  });

  it("refuses an attempt from a viewer who never joined", async () => {
    await contest("PASTE04");
    const stranger = testUser({ email: "stranger@example.com" });
    const context = await loadParticipantContext("PASTE04", stranger.id, {
      now: inContest,
    });

    await expect(
      logViolation(context, { kind: "paste_blocked" }, { now: inContest }),
    ).rejects.toMatchObject({ code: "not_joined", status: 403 });
  });

  it("refuses an attempt once the contest is locked", async () => {
    const { participant } = await contest("PASTE05");
    const context = await loadParticipantContext("PASTE05", solver.id, {
      now: addMinutes(deadlineAt, 1),
    });

    await expect(
      logViolation(context, { kind: "paste_blocked" }, {
        now: addMinutes(deadlineAt, 1),
      }),
    ).rejects.toMatchObject({ code: "contest_locked", status: 409 });
    expect(await loggedViolations(participant.id)).toEqual([]);
  });
});

describe("which gestures are a blocked attempt", () => {
  it("treats Ctrl+V and Cmd+V as a blocked paste", () => {
    expect(
      blockedKindFor({ type: "keydown", key: "v", ctrlKey: true, metaKey: false }),
    ).toBe("paste_blocked");
    expect(
      blockedKindFor({ type: "keydown", key: "V", ctrlKey: false, metaKey: true }),
    ).toBe("paste_blocked");
  });

  it("does not block typing a plain v, or copying out", () => {
    expect(
      blockedKindFor({ type: "keydown", key: "v", ctrlKey: false, metaKey: false }),
    ).toBeNull();
    expect(
      blockedKindFor({ type: "keydown", key: "c", ctrlKey: true, metaKey: false }),
    ).toBeNull();
    expect(blockedKindFor({ type: "copy" })).toBeNull();
  });

  it("treats the paste event, a drop, and a middle click as blocked pastes", () => {
    expect(blockedKindFor({ type: "paste" })).toBe("paste_blocked");
    expect(blockedKindFor({ type: "drop" })).toBe("paste_blocked");
    expect(
      blockedKindFor({ type: "mousedown", button: 1 }),
    ).toBe("paste_blocked");
    expect(blockedKindFor({ type: "mousedown", button: 0 })).toBeNull();
  });

  it("treats right-click as a suppressed context menu, not a paste", () => {
    expect(blockedKindFor({ type: "contextmenu" })).toBe("context_menu_blocked");
  });

  it("names the one toast blocked pastes produce", () => {
    expect(PASTE_BLOCKED_MESSAGE).toBe("Pasting is disabled.");
    expect(blockedMessage("paste_blocked")).toBe("Pasting is disabled.");
    expect(blockedMessage("context_menu_blocked")).toBeNull();
  });

  it("collapses the duplicate signals from one attempt", () => {
    expect(shouldReportAttempt(undefined, 1_000)).toBe(true);
    expect(shouldReportAttempt(1_000, 1_100, 250)).toBe(false);
    expect(shouldReportAttempt(1_000, 1_250, 250)).toBe(true);
  });
});

/**
 * A browser-API fake: the guards only need somewhere to hang listeners and the
 * two Monaco hooks. No Postgres is involved.
 */
function fakeEditor() {
  const reported: ViolationKind[] = [];
  const nodeListeners = new Map<
    string,
    (event: FakeGuardEvent) => void
  >();
  const commands: Array<{ keybinding: number; handler: () => void }> = [];

  let keyDown:
    | ((event: { browserEvent: FakeGuardEvent }) => void)
    | undefined;
  let contextMenu:
    | ((event: { event: { preventDefault(): void } }) => void)
    | undefined;

  const node = {
    addEventListener(type: string, listener: (event: FakeGuardEvent) => void) {
      nodeListeners.set(type, listener);
    },
    removeEventListener(type: string) {
      nodeListeners.delete(type);
    },
  };

  const editor = {
    addCommand(keybinding: number, handler: () => void) {
      commands.push({ keybinding, handler });
      return "command";
    },
    onKeyDown(listener: (event: { browserEvent: FakeGuardEvent }) => void) {
      keyDown = listener;
      return { dispose() {} };
    },
    onContextMenu(
      listener: (event: { event: { preventDefault(): void } }) => void,
    ) {
      contextMenu = listener;
      return { dispose() {} };
    },
    getDomNode() {
      return node;
    },
  };

  return {
    editor,
    commands,
    nodeListeners,
    reported,
    keyDown: (event: FakeGuardEvent) =>
      keyDown?.({ browserEvent: event }),
    contextMenu: () => contextMenu?.({ event: fakeEvent() }),
  };
}

type FakeGuardEvent = {
  type: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  button?: number;
  prevented?: boolean;
  preventDefault(): void;
};

function fakeEvent(overrides: Partial<FakeGuardEvent> = {}) {
  const event: FakeGuardEvent = {
    type: "paste",
    preventDefault() {
      event.prevented = true;
    },
    ...overrides,
  };
  return event;
}

describe("the editor guards", () => {
  function install() {
    const fake = fakeEditor();
    const dispose = installEditorGuards({
      editor: fake.editor,
      keybinding: 2_048,
      report: (kind) => fake.reported.push(kind),
    });
    return { ...fake, dispose };
  }

  it("swallows Monaco's own paste command", () => {
    const fake = install();
    expect(fake.commands).toHaveLength(1);
    expect(fake.commands[0].keybinding).toBe(2_048);

    fake.commands[0].handler();
    expect(fake.reported).toEqual(["paste_blocked"]);
  });

  it("blocks the keyboard shortcut and still lets a plain v through", () => {
    const fake = install();

    const paste = fakeEvent({ type: "keydown", key: "v", ctrlKey: true });
    fake.keyDown(paste);
    expect(paste.prevented).toBe(true);
    expect(fake.reported).toEqual(["paste_blocked"]);

    const typed = fakeEvent({ type: "keydown", key: "v" });
    fake.keyDown(typed);
    expect(typed.prevented).toBeUndefined();
    expect(fake.reported).toEqual(["paste_blocked"]);
  });

  it("blocks paste, drop, middle click, and right-click at the editor node", () => {
    const fake = install();

    for (const type of ["paste", "drop"] as const) {
      const event = fakeEvent({ type });
      fake.nodeListeners.get(type)?.(event);
      expect(event.prevented).toBe(true);
    }

    const middle = fakeEvent({ type: "mousedown", button: 1 });
    fake.nodeListeners.get("mousedown")?.(middle);
    expect(middle.prevented).toBe(true);

    const rightClick = fakeEvent({ type: "contextmenu" });
    fake.nodeListeners.get("contextmenu")?.(rightClick);
    expect(rightClick.prevented).toBe(true);

    expect(fake.reported).toEqual([
      "paste_blocked",
      "paste_blocked",
      "paste_blocked",
      "context_menu_blocked",
    ]);
    expect(fake.contextMenu).toBeTypeOf("function");
    fake.contextMenu();
    expect(fake.reported.at(-1)).toBe("context_menu_blocked");
  });

  it("leaves left clicks, copying, and normal drag-over alone", () => {
    const fake = install();

    const leftClick = fakeEvent({ type: "mousedown", button: 0 });
    fake.nodeListeners.get("mousedown")?.(leftClick);
    expect(leftClick.prevented).toBeUndefined();

    // There is no copy listener at all: copying out is untouched.
    expect(fake.nodeListeners.has("copy")).toBe(false);
    expect(fake.nodeListeners.has("cut")).toBe(false);

    const dragOver = fakeEvent({ type: "dragover" });
    fake.nodeListeners.get("dragover")?.(dragOver);
    expect(dragOver.prevented).toBe(true); // dropping is not a valid target
    expect(fake.reported).toEqual([]);
  });

  it("removes every listener when the editor unmounts", () => {
    const fake = install();
    fake.dispose();
    expect(fake.nodeListeners.size).toBe(0);
  });
});
