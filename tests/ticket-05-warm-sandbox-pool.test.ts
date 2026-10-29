import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  claimSandbox,
  getReadyCount,
  releaseSandbox,
  replenishPool,
  scheduleReplenish,
  withClaimedSandbox,
} from "@/lib/runner/pool";
import { createE2BSandboxProvider } from "@/lib/runner/sandbox";
import { FakeSandboxProvider } from "./helpers/fake-sandbox-provider";
import { db, useCleanDatabase } from "./helpers/db";

useCleanDatabase();

describe("warm sandbox pool", () => {
  it("replenishes to the target and never exceeds it", async () => {
    const provider = new FakeSandboxProvider();

    await expect(replenishPool({ provider, target: 3 })).resolves.toBe(3);
    expect(provider.created).toHaveLength(3);
    await expect(getReadyCount()).resolves.toBe(3);

    await expect(replenishPool({ provider, target: 3 })).resolves.toBe(0);
    expect(provider.created).toHaveLength(3);
    await expect(getReadyCount()).resolves.toBe(3);
  });

  it("never gives two simultaneous claims the same sandbox", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 2 });

    const [first, second] = await Promise.all([
      claimSandbox({ provider }),
      claimSandbox({ provider }),
    ]);

    expect(first.sandboxId).not.toBe(second.sandboxId);
    expect(new Set([first.sandboxId, second.sandboxId])).toEqual(
      new Set(provider.created),
    );
    await expect(getReadyCount()).resolves.toBe(0);
  });

  it("fills an empty pool itself so the first Run cannot deadlock", async () => {
    const provider = new FakeSandboxProvider();
    await expect(getReadyCount()).resolves.toBe(0);

    // SPEC §7: a request that finds the pool short replenishes it. Before this,
    // a cold pool was filled only by an action that ran *after* a successful
    // Run, so the first Run could never succeed and nothing ever filled it.
    const claim = await claimSandbox({ provider, timeoutMs: 10_000 });

    expect(claim.sandboxId).toBe("sandbox-1");
    expect(provider.created).toEqual(["sandbox-1"]);
    expect(provider.connected).toEqual(["sandbox-1"]);
  });

  it("releases the sandbox when the run throws", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.runError = new Error("the run exploded");

    await expect(
      withClaimedSandbox({ provider }, async (claim) => {
        await claim.handle.run("python main.py");
      }),
    ).rejects.toThrow("the run exploded");

    await expect(getReadyCount()).resolves.toBe(1);
    expect(provider.killed).toEqual([]);
  });

  it("discards a dead sandbox, replaces it, and retries the claim once", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.killOutOfBand("sandbox-1");

    const claim = await claimSandbox({ provider });

    expect(claim.sandboxId).toBe("sandbox-2");
    expect(provider.created).toEqual(["sandbox-1", "sandbox-2"]);
    expect(provider.connected).toEqual(["sandbox-1", "sandbox-2"]);
    await expect(getReadyCount()).resolves.toBe(0);
  });

  it("replaces a sandbox that is reachable but no longer running", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.killOutOfBand("sandbox-1");
    provider.connectDeadSandboxes = true;

    const claim = await claimSandbox({ provider });

    expect(claim.sandboxId).toBe("sandbox-2");
    expect(provider.created).toEqual(["sandbox-1", "sandbox-2"]);
  });

  it("gives up after one replacement when the replacement is dead too", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    provider.killOutOfBand("sandbox-1");
    provider.createDeadSandboxes = true;

    await expect(claimSandbox({ provider })).rejects.toMatchObject({
      code: "runner_busy",
      status: 503,
    });
    expect(provider.created).toHaveLength(2);
  });

  it("reuses the same sandbox across sequential claims without killing it", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });

    const first = await claimSandbox({ provider });
    await releaseSandbox(first);
    const second = await claimSandbox({ provider });

    expect(second.sandboxId).toBe(first.sandboxId);
    expect(provider.created).toHaveLength(1);
    expect(provider.killed).toEqual([]);

    await releaseSandbox(second);
    await expect(getReadyCount()).resolves.toBe(1);
  });

  it("counts claimed sandboxes toward the target", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 2 });

    await claimSandbox({ provider });

    await expect(replenishPool({ provider, target: 2 })).resolves.toBe(0);
    expect(provider.created).toHaveLength(2);
  });

  it("does not exceed the target when two replenishments race", async () => {
    const provider = new FakeSandboxProvider();

    await Promise.all([
      replenishPool({ provider, target: 3 }),
      replenishPool({ provider, target: 3 }),
    ]);

    expect(provider.created).toHaveLength(3);
    await expect(getReadyCount()).resolves.toBe(3);
  });

  it("returns a 503 when the pool is at target but every sandbox is claimed", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 1 });
    await claimSandbox({ provider });

    // Nothing is claimable and the pool is already at target, so the claim must
    // bound itself rather than create sandboxes without limit.
    await expect(
      claimSandbox({ provider, timeoutMs: 150 }),
    ).rejects.toMatchObject({ code: "runner_busy", status: 503 });
    expect(provider.created).toHaveLength(1);
  });

  it("returns a 503 when the sandbox provider cannot create a sandbox", async () => {
    const provider = createE2BSandboxProvider({ apiKey: "" });

    await expect(
      claimSandbox({ provider, timeoutMs: 5_000 }),
    ).rejects.toMatchObject({ code: "runner_busy", status: 503 });
  });

  it("reflects claimed, released, and dead rows in the ready count", async () => {
    const provider = new FakeSandboxProvider();
    await replenishPool({ provider, target: 2 });
    await expect(getReadyCount()).resolves.toBe(2);

    const claim = await claimSandbox({ provider });
    await expect(getReadyCount()).resolves.toBe(1);

    await releaseSandbox(claim);
    await expect(getReadyCount()).resolves.toBe(2);

    // A row marked dead by a failed health check is not ready.
    await db.execute(
      sql`update runner_pool set state = 'dead' where id = ${claim.poolId}`,
    );
    await expect(getReadyCount()).resolves.toBe(1);
  });

  it("tops up from a background callback handed to after()", async () => {
    const provider = new FakeSandboxProvider();

    await scheduleReplenish({ provider, target: 2 })();

    await expect(getReadyCount()).resolves.toBe(2);
  });
});

describe("E2B provider configuration", () => {
  it("refuses to create a sandbox when no API key is configured", async () => {
    const provider = createE2BSandboxProvider({ apiKey: "" });

    await expect(provider.create()).rejects.toMatchObject({
      code: "runner_not_configured",
      status: 503,
    });
  });
});
