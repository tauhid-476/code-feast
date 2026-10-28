import { FileNotFoundError, NotFoundError, SandboxNotFoundError } from "e2b";
import { describe, expect, it, vi } from "vitest";
import { feedStdin, type StdinTarget } from "@/lib/runner/sandbox";

/**
 * Ticket 05 claimed the E2B stdin seam was unverified. A live sandbox showed
 * that a command which exits before stdin is attached makes E2B refuse the
 * write with "process with pid N not found". Every fast program hits that, so
 * the rule above the seam is: a finished process is not a failure.
 */

function target(overrides: Partial<StdinTarget> = {}): StdinTarget {
  return {
    sendStdin: vi.fn(async () => undefined),
    closeStdin: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("feeding stdin to a sandbox command", () => {
  it("sends the input and then closes stdin", async () => {
    const handle = target();

    await feedStdin(handle, "2 7 11 15\n9\n");

    expect(handle.sendStdin).toHaveBeenCalledWith("2 7 11 15\n9\n");
    expect(handle.closeStdin).toHaveBeenCalledTimes(1);
  });

  it("closes stdin even when there is no input, so a reader sees EOF", async () => {
    const handle = target();

    await feedStdin(handle, undefined);

    expect(handle.sendStdin).not.toHaveBeenCalled();
    expect(handle.closeStdin).toHaveBeenCalledTimes(1);
  });

  it("treats a process that already finished as a normal outcome", async () => {
    const handle = target({
      sendStdin: vi.fn(async () => {
        throw new NotFoundError("[not_found] process with pid 1550 not found");
      }),
    });

    await expect(feedStdin(handle, "input\n")).resolves.toBeUndefined();
  });

  it("treats a finished process as normal when only closing stdin fails", async () => {
    const handle = target({
      closeStdin: vi.fn(async () => {
        throw new NotFoundError("[not_found] process with pid 1552 not found");
      }),
    });

    await expect(feedStdin(handle, "input\n")).resolves.toBeUndefined();
  });

  it("still reports a sandbox that is gone", async () => {
    const handle = target({
      sendStdin: vi.fn(async () => {
        throw new SandboxNotFoundError("sandbox not found");
      }),
    });

    await expect(feedStdin(handle, "input\n")).rejects.toBeInstanceOf(
      SandboxNotFoundError,
    );
  });

  it("still reports a missing file rather than swallowing it", async () => {
    const handle = target({
      sendStdin: vi.fn(async () => {
        throw new FileNotFoundError("no such file");
      }),
    });

    await expect(feedStdin(handle, "input\n")).rejects.toBeInstanceOf(
      FileNotFoundError,
    );
  });

  it("does not mask unrelated transport failures", async () => {
    const handle = target({
      sendStdin: vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    });

    await expect(feedStdin(handle, "input\n")).rejects.toThrow("socket hang up");
  });
});
