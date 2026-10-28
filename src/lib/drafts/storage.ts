import type { Language } from "@/lib/languages";
import type { DraftSnapshot } from "./merge";

/**
 * The crash-safe mirror of the editor buffer. Written on every keystroke so a
 * browser crash loses nothing the participant typed; the server copy remains
 * the source of truth once a save is acknowledged.
 */

const PREFIX = "codefeast:draft";

export function storageKey(
  participantId: string,
  problemId: string,
  language: Language,
): string {
  return `${PREFIX}:${participantId}:${problemId}:${language}`;
}

export function readLocalDraft(key: string): DraftSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as DraftSnapshot).code !== "string" ||
      typeof (parsed as DraftSnapshot).updatedAt !== "number"
    ) {
      return null;
    }

    return {
      code: (parsed as DraftSnapshot).code,
      updatedAt: (parsed as DraftSnapshot).updatedAt,
    };
  } catch {
    // Private mode, a quota error, or a hand-edited value: treat as no copy.
    return null;
  }
}

export function writeLocalDraft(key: string, snapshot: DraftSnapshot): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // A full quota must never stop the participant typing; the banner already
    // tells them the server copy is the one that is failing.
  }
}

export function removeLocalDraft(key: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do.
  }
}
