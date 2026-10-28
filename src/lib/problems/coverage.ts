import { LANGUAGE_LABELS, LANGUAGES, type Language } from "@/lib/languages";

/**
 * Authoring completeness: which languages still lack a visible Starter Code or
 * a Harness before an event starts. Pure and client-safe so the authoring
 * surface can call it directly.
 */
export type StarterPresence = {
  language: Language;
  starterCode: string;
  harnessCode: string;
};

export type LanguageCoverage = {
  complete: boolean;
  missingStarter: Language[];
  missingHarness: Language[];
  /** One sentence per missing kind, naming the languages. */
  summary: string;
};

export function languageCoverage(
  starters: readonly StarterPresence[],
): LanguageCoverage {
  const byLanguage = new Map(starters.map((pair) => [pair.language, pair]));
  const missingStarter: Language[] = [];
  const missingHarness: Language[] = [];

  for (const language of LANGUAGES) {
    const pair = byLanguage.get(language);
    if (!pair || !pair.starterCode.trim()) missingStarter.push(language);
    if (!pair || !pair.harnessCode.trim()) missingHarness.push(language);
  }

  return {
    complete: missingStarter.length === 0 && missingHarness.length === 0,
    missingStarter,
    missingHarness,
    summary: [
      missingStarter.length > 0
        ? `Missing starter code for ${labels(missingStarter)}.`
        : null,
      missingHarness.length > 0
        ? `Missing harness for ${labels(missingHarness)}.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function labels(languages: Language[]): string {
  return languages.map((language) => LANGUAGE_LABELS[language]).join(", ");
}
