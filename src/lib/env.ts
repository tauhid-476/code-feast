/**
 * Environment access with one place to see every variable the app needs.
 * Secrets stay server-side; nothing here is exported to the browser bundle.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function databaseUrl(): string {
  return required("DATABASE_URL");
}

export function neonAuthBaseUrl(): string {
  return required("NEON_AUTH_BASE_URL");
}

export function neonAuthCookieSecret(): string {
  return required("NEON_AUTH_COOKIE_SECRET");
}

/**
 * `ADMIN_EMAILS` is a comma-separated allowlist. Emails are compared
 * case-insensitively and whitespace is ignored, so "A@x.com, b@x.com" works.
 */
export function organizerEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * `SUPER_ADMIN_EMAILS` defaults to `ADMIN_EMAILS`.
 * Only users in this list can access super-admin actions like whitelisting organizers.
 */
export function superAdminEmails(): string[] {
  if (process.env.SUPER_ADMIN_EMAILS !== undefined) {
    return process.env.SUPER_ADMIN_EMAILS
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }
  if (process.env.ADMIN_EMAILS !== undefined) {
    return process.env.ADMIN_EMAILS
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.trim().toLowerCase());
}

export function isOrganizerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    organizerEmails().includes(normalized) ||
    superAdminEmails().includes(normalized)
  );
}

/**
 * E2B credentials are optional at import time: the app builds and the test
 * suite runs without a key. The runner provider refuses only when it is asked
 * to create or connect to a sandbox.
 */
export function e2bApiKey(): string | undefined {
  return process.env.E2B_API_KEY || undefined;
}

export function e2bTemplateId(): string | undefined {
  return process.env.E2B_TEMPLATE_ID || undefined;
}

export type FiguresStorageConfig = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucket: string;
};

/**
 * Object storage for Figures is optional, exactly like E2B. Neon injects the
 * AWS-standard variables when a branch has a bucket; without them statements
 * still render and only the upload control is disabled.
 */
export function figuresStorageConfig(): FiguresStorageConfig | null {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION;

  if (!accessKeyId || !secretAccessKey || !endpoint || !region) return null;

  return {
    accessKeyId,
    secretAccessKey,
    endpoint,
    region,
    bucket: process.env.FIGURES_BUCKET || "figures",
  };
}

export function figuresStorageConfigured(): boolean {
  return figuresStorageConfig() !== null;
}

/**
 * Language vocabulary lives in a neutral module so client components can read
 * it without importing anything that touches `process.env` rationale.
 */
export {
  LANGUAGES,
  LANGUAGE_LABELS,
  isLanguage,
  type Language,
} from "./languages";

export const STRIKE_LIMIT = 3;
export const STRIKE_DEDUPE_WINDOW_MS = 2_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
