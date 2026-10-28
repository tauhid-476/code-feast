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

export function isOrganizerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return organizerEmails().includes(email.trim().toLowerCase());
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

/**
 * Language vocabulary lives in a neutral module so client components can read
 * it without importing anything that touches `process.env`.
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
