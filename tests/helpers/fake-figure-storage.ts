import type {
  FigureObject,
  FigureObjectHead,
  FigureStorage,
  PresignPostInput,
  PresignedPost,
} from "@/lib/figures/storage";

/**
 * An in-memory stand-in for the figures bucket. It records the presigns and
 * removes a test cares about, and lets a test place the object the browser
 * would have uploaded. Same seam as `fake-sandbox-provider.ts`.
 */
export class FakeFigureStorage implements FigureStorage {
  readonly objects = new Map<string, FigureObject>();
  readonly presigned: PresignPostInput[] = [];
  readonly removed: string[] = [];

  /** When set, `presignPost` throws instead of returning a URL. */
  presignError: Error | null = null;

  async presignPost(input: PresignPostInput): Promise<PresignedPost> {
    this.presigned.push(input);
    if (this.presignError) throw this.presignError;
    return {
      url: "https://storage.example/upload",
      fields: {
        key: input.key,
        "Content-Type": input.contentType,
      },
    };
  }

  /** Simulates the browser's POST landing in the bucket. */
  put(
    key: string,
    contentType: string,
    bytes = 1024,
    body: Uint8Array = new Uint8Array([1, 2, 3]),
  ): void {
    this.objects.set(key, { contentType, bytes, body });
  }

  async head(key: string): Promise<FigureObjectHead | null> {
    const object = this.objects.get(key);
    return object
      ? { contentType: object.contentType, bytes: object.bytes }
      : null;
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key);
    this.objects.delete(key);
  }

  async read(key: string): Promise<FigureObject | null> {
    return this.objects.get(key) ?? null;
  }
}
