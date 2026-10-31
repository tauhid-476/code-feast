import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { figuresStorageConfig, type FiguresStorageConfig } from "@/lib/env";
import {
  MAX_FIGURE_BYTES,
  type FigureContentType,
} from "./types";

/**
 * The only module that imports the AWS SDK. Domain code takes an optional
 * `storage` so tests can inject an in-memory implementation, the same seam
 * `src/lib/runner/pool.ts` uses for the sandbox provider.
 */

export type PresignPostInput = {
  key: string;
  contentType: FigureContentType;
  bytes: number;
};

export type PresignedPost = {
  /** The bucket endpoint the browser POSTs the form to. */
  url: string;
  fields: Record<string, string>;
};

export type FigureObjectHead = {
  contentType: string;
  bytes: number;
};

export type FigureObject = FigureObjectHead & {
  body: Uint8Array;
};

export interface FigureStorage {
  presignPost(input: PresignPostInput): Promise<PresignedPost>;
  head(key: string): Promise<FigureObjectHead | null>;
  remove(key: string): Promise<void>;
  read(key: string): Promise<FigureObject | null>;
}

function isMissingObject(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}

class S3FigureStorage implements FigureStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: FiguresStorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Neon's S3 endpoint is path-style; virtual-host style would address
      // `<bucket>.<endpoint>` which it does not serve.
      forcePathStyle: true,
    });
  }

  async presignPost(input: PresignPostInput): Promise<PresignedPost> {
    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: this.bucket,
      Key: input.key,
      Expires: 600,
      Conditions: [
        ["eq", "$Content-Type", input.contentType],
        // The object can never be larger than the advertised size, and the
        // overall Figure cap is a hard ceiling.
        ["content-length-range", 1, Math.min(input.bytes, MAX_FIGURE_BYTES)],
      ],
      Fields: {
        "Content-Type": input.contentType,
      },
    });
    return { url, fields };
  }

  async head(key: string): Promise<FigureObjectHead | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.ContentType || !response.ContentLength) return null;
      return {
        contentType: response.ContentType,
        bytes: response.ContentLength,
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async read(key: string): Promise<FigureObject | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!response.Body) return null;
      const body = await response.Body.transformToByteArray();
      return {
        contentType: response.ContentType ?? "application/octet-stream",
        bytes: body.byteLength,
        body,
      };
    } catch (error) {
      if (isMissingObject(error)) return null;
      throw error;
    }
  }
}

let cached: { key: string; storage: FigureStorage } | null = null;

/**
 * The real storage, or null when the bucket is not configured. Callers treat
 * null as "storage unavailable" and refuse only the upload paths.
 */
export function defaultFigureStorage(): FigureStorage | null {
  const config = figuresStorageConfig();
  if (!config) return null;

  const key = `${config.endpoint}|${config.bucket}|${config.accessKeyId}`;
  if (cached?.key !== key) {
    cached = { key, storage: new S3FigureStorage(config) };
  }
  return cached.storage;
}
