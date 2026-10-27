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

export const LANGUAGES = ["python", "java", "cpp"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python 3",
  java: "Java",
  cpp: "C++",
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}

export const STRIKE_LIMIT = 3;
export const STRIKE_DEDUPE_WINDOW_MS = 2_000;
export const HEARTBEAT_INTERVAL_MS = 5_000;
