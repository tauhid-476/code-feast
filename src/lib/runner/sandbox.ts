import {
  CommandExitError,
  FileNotFoundError,
  NotFoundError,
  Sandbox,
  SandboxNotFoundError,
  SandboxNotRunningError,
  SandboxUnreachableError,
  TimeoutError,
  type CommandHandle,
} from "e2b";
import { e2bApiKey, e2bTemplateId } from "@/lib/env";
import { DomainError } from "@/lib/errors";

/**
 * The transport seam between the pool and E2B. The pool only knows how to
 * create, connect to, and drive a sandbox; tests inject a fake provider so the
 * suite never needs an E2B key or a real sandbox.
 */

/** One hour, the Hobby-tier maximum. Sandboxes live for the whole event. */
export const SANDBOX_TIMEOUT_MS = 60 * 60 * 1000;

/** Compile is allowed 15s; a Run passes its own per-case limit. */
export const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;

export type SandboxRunOptions = {
  /** Written to the command's stdin, then closed so readers see EOF. */
  stdin?: string;
  timeoutMs?: number;
};

export type SandboxRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  ms: number;
};

export interface SandboxHandle {
  readonly id: string;
  writeFile(path: string, content: string): Promise<void>;
  run(command: string, options?: SandboxRunOptions): Promise<SandboxRunResult>;
  kill(): Promise<void>;
  isAlive(): Promise<boolean>;
}

export interface SandboxProvider {
  create(): Promise<SandboxHandle>;
  connect(sandboxId: string): Promise<SandboxHandle>;
}

/**
 * A command that ran past its limit. This is a normal Run outcome (TLE), not a
 * runner failure, so callers can distinguish it from a dead sandbox.
 */
export class SandboxTimeoutError extends Error {
  constructor(
    message = "The sandbox command timed out.",
    readonly stdout = "",
    readonly stderr = "",
  ) {
    super(message);
    this.name = "SandboxTimeoutError";
  }
}

export type E2BSandboxProviderOptions = {
  /** Explicit key wins over the environment; "" means "no key". */
  apiKey?: string;
  template?: string;
};

function resolveApiKey(options: E2BSandboxProviderOptions): string {
  const key = options.apiKey !== undefined ? options.apiKey : e2bApiKey();
  if (!key) {
    throw new DomainError(
      "runner_not_configured",
      "The runner is not configured. Set E2B_API_KEY.",
      503,
    );
  }
  return key;
}

/**
 * E2B permits one sandbox creation per second per account. Warm-up is a
 * background job, so pacing it is cheaper than collecting 429s. The gate is
 * module-level because each request may construct its own provider.
 */
const CREATE_INTERVAL_MS = 1_000;
let createGate: Promise<void> = Promise.resolve();
let lastCreateAt = 0;

function pacedCreate<T>(create: () => Promise<T>): Promise<T> {
  const run = createGate.then(async () => {
    const wait = lastCreateAt + CREATE_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    try {
      return await create();
    } finally {
      lastCreateAt = Date.now();
    }
  });
  createGate = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * The parts of an E2B command handle stdin feeding needs. Narrow on purpose so
 * the "process already finished" rule can be tested without a live sandbox.
 */
export type StdinTarget = {
  sendStdin(data: string): Promise<void>;
  closeStdin(): Promise<void>;
};

/**
 * True when stdin could not be delivered because the command had already
 * finished. E2B answers with a plain `NotFoundError` naming a pid; a sandbox or
 * file that is gone is a `SandboxNotFoundError` / `FileNotFoundError` and must
 * keep failing, because those are real runner failures.
 */
function isFinishedProcess(error: unknown): boolean {
  return (
    error instanceof NotFoundError &&
    !(error instanceof SandboxNotFoundError) &&
    !(error instanceof FileNotFoundError)
  );
}

/**
 * Delivers stdin, then closes it so a program reading to EOF terminates.
 *
 * A command that never reads stdin can exit before the stream is attached; E2B
 * then refuses the write with "process ... not found". That is not a failure —
 * the command produced its output without ever asking for input — so the write
 * is skipped and the caller still collects the result from `wait()`. Without
 * this, every fast program would surface as a runner error.
 */
export async function feedStdin(
  handle: StdinTarget,
  input: string | undefined,
): Promise<void> {
  try {
    if (input !== undefined) await handle.sendStdin(input);
    await handle.closeStdin();
  } catch (error) {
    if (isFinishedProcess(error)) return;
    throw error;
  }
}

class E2BSandboxHandle implements SandboxHandle {
  constructor(private readonly sandbox: Sandbox) {}

  get id(): string {
    return this.sandbox.sandboxId;
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.sandbox.files.write(path, content);
  }

  async run(
    command: string,
    options: SandboxRunOptions = {},
  ): Promise<SandboxRunResult> {
    const startedAt = Date.now();
    const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const handle = (await this.sandbox.commands.run(command, {
      background: true,
      stdin: true,
      timeoutMs,
    })) as CommandHandle;

    try {
      await feedStdin(handle, options.stdin);
    } catch (error) {
      await handle.kill().catch(() => false);
      throw error;
    }

    try {
      const result = await handle.wait();
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        ms: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof CommandExitError) {
        return {
          stdout: error.stdout,
          stderr: error.stderr,
          exitCode: error.exitCode,
          ms: Date.now() - startedAt,
        };
      }
      // A sandbox that vanished mid-run is not a TLE; let ticket 06 report it
      // as a sandbox error rather than a timeout.
      if (
        error instanceof SandboxNotRunningError ||
        error instanceof SandboxUnreachableError
      ) {
        throw error;
      }
      if (error instanceof TimeoutError) {
        throw new SandboxTimeoutError(
          "The sandbox command timed out.",
          handle.stdout,
          handle.stderr,
        );
      }
      throw error;
    }
  }

  async kill(): Promise<void> {
    await this.sandbox.kill();
  }

  async isAlive(): Promise<boolean> {
    return this.sandbox.isRunning();
  }
}

/**
 * The real provider. It reads `E2B_API_KEY` when a sandbox is created or
 * connected, never at import time, so the app builds and tests run without one.
 */
export function createE2BSandboxProvider(
  options: E2BSandboxProviderOptions = {},
): SandboxProvider {
  const template = options.template ?? e2bTemplateId();

  return {
    async create() {
      const sandbox = await pacedCreate(() =>
        Sandbox.create({
          apiKey: resolveApiKey(options),
          timeoutMs: SANDBOX_TIMEOUT_MS,
          allowInternetAccess: false,
          ...(template ? { template } : {}),
        }),
      );
      return new E2BSandboxHandle(sandbox);
    },

    async connect(sandboxId: string) {
      const sandbox = await Sandbox.connect(sandboxId, {
        apiKey: resolveApiKey(options),
      });
      return new E2BSandboxHandle(sandbox);
    },
  };
}

/** Shared instance for the app; tests pass their own provider instead. */
export const e2bSandboxProvider: SandboxProvider = createE2BSandboxProvider();
