/**
 * The three languages a Problem carries. Neutral vocabulary: the database,
 * domain modules, and client components all use these values, so this module
 * must stay free of server-only imports.
 */
export const LANGUAGES = ["python", "java", "cpp"] as const;

export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python 3",
  java: "Java",
  cpp: "C++",
};

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" && (LANGUAGES as readonly string[]).includes(value)
  );
}

/** The constant order used wherever languages are listed. */
export function languageRank(language: Language): number {
  return LANGUAGES.indexOf(language);
}
