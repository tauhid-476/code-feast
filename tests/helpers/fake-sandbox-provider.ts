import type {
  SandboxHandle,
  SandboxProvider,
  SandboxRunOptions,
  SandboxRunResult,
} from "@/lib/runner/sandbox";

/** One recorded `run` call, handed to a scripted handler. */
export type FakeRunCall = {
  id: string;
  command: string;
  options: SandboxRunOptions;
};

/**
 * Scripts a single `run` call. Returning nothing falls back to the default
 * success, so a handler only has to describe the calls it cares about.
 */
export type FakeRunHandler = (
  call: FakeRunCall,
) => Promise<SandboxRunResult | null> | SandboxRunResult | null;

/**
 * An in-memory stand-in for E2B. It records the transport calls the pool makes
 * and lets a test kill a sandbox out-of-band or make a run fail, so the pool's
 * claim/release/replace behaviour is exercised without a network or a key.
 * A run handler scripts stdout, exit codes, stderr and slow runs.
 */
export class FakeSandboxProvider implements SandboxProvider {
  readonly created: string[] = [];
  readonly connected: string[] = [];
  readonly killed: string[] = [];
  readonly written: Array<{ id: string; path: string; content: string }> = [];
  readonly runs: Array<{ id: string; command: string; options: SandboxRunOptions }> =
    [];

  /** Sandboxes that no longer exist, whether killed by a test or the provider. */
  readonly dead = new Set<string>();

  /** When set, `run` throws instead of returning a result. */
  runError: Error | null = null;

  /** When set, `run` asks it for a result before falling back. */
  runHandler: FakeRunHandler | null = null;

  /**
   * When true, connecting to a dead sandbox succeeds but `isAlive` reports
   * false. Exercises the health check without a connect failure.
   */
  connectDeadSandboxes = false;

  /** When true, newly created sandboxes are already dead. */
  createDeadSandboxes = false;

  private nextId = 1;

  async create(): Promise<SandboxHandle> {
    const id = `sandbox-${this.nextId++}`;
    this.created.push(id);
    if (this.createDeadSandboxes) this.dead.add(id);
    return this.handle(id);
  }

  async connect(sandboxId: string): Promise<SandboxHandle> {
    this.connected.push(sandboxId);
    if (this.dead.has(sandboxId) && !this.connectDeadSandboxes) {
      throw new Error(`Sandbox ${sandboxId} is not running.`);
    }
    return this.handle(sandboxId);
  }

  /** Simulates a sandbox disappearing outside the pool (expiry, crash, kill). */
  killOutOfBand(sandboxId: string): void {
    this.dead.add(sandboxId);
  }

  private handle(id: string): SandboxHandle {
    return {
      id,
      writeFile: async (path, content) => {
        this.written.push({ id, path, content });
      },
      run: async (command, options = {}) => {
        const call: FakeRunCall = { id, command, options };
        this.runs.push(call);
        if (this.runError) throw this.runError;
        if (this.runHandler) {
          const scripted = await this.runHandler(call);
          if (scripted) return scripted;
        }
        const result: SandboxRunResult = {
          stdout: "",
          stderr: "",
          exitCode: 0,
          ms: 1,
        };
        return result;
      },
      kill: async () => {
        this.killed.push(id);
        this.dead.add(id);
      },
      isAlive: async () => !this.dead.has(id),
    };
  }
}
