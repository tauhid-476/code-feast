"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProblemStarterAction } from "@/app/admin/events/[id]/actions";
import {
  LanguagePairFields,
  type StarterPairDraft,
} from "@/components/language-pair-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LANGUAGE_LABELS, LANGUAGES, isLanguage, type Language } from "@/lib/languages";
import type { ProblemSummary } from "@/lib/problems/queries";

type Drafts = Record<Language, StarterPairDraft>;

function draftsFrom(starters: ProblemSummary["starters"]): Drafts {
  const drafts = Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      { starterCode: "", harnessCode: "" } satisfies StarterPairDraft,
    ]),
  ) as Drafts;

  for (const pair of starters) {
    drafts[pair.language] = {
      starterCode: pair.starterCode,
      harnessCode: pair.harnessCode,
    };
  }
  return drafts;
}

function samePair(a: StarterPairDraft, b: StarterPairDraft): boolean {
  return (
    a.starterCode === b.starterCode && a.harnessCode === b.harnessCode
  );
}

/**
 * Per-language Starter Code and Harness authoring with Monaco editors.
 * Language tabs show an unsaved-changes dot when the current draft differs
 * from the saved version. Cmd/Ctrl+S saves the active language.
 */
export function ProblemLanguages({
  eventId,
  problem,
}: {
  eventId: string;
  problem: ProblemSummary;
}) {
  const [saved, setSaved] = useState<Drafts>(() => draftsFrom(problem.starters));
  const [drafts, setDrafts] = useState<Drafts>(() => draftsFrom(problem.starters));
  const [active, setActive] = useState<Language>("python");
  const [pendingLanguage, setPendingLanguage] = useState<Language | null>(null);
  const [error, setError] = useState<{ language: Language; message: string } | null>(
    null,
  );
  const [saving, startSaving] = useTransition();

  function patch(language: Language, change: Partial<StarterPairDraft>) {
    setDrafts((current) => ({
      ...current,
      [language]: { ...current[language], ...change },
    }));
  }

  const save = useCallback(
    (language: Language) => {
      const pair = drafts[language];
      setError(null);
      setPendingLanguage(language);

      startSaving(async () => {
        const result = await saveProblemStarterAction(
          eventId,
          problem.id,
          language,
          pair,
        );
        setPendingLanguage(null);

        if ("error" in result) {
          setError({ language, message: result.error });
          return;
        }

        setSaved((current) => ({ ...current, [language]: pair }));
        toast.success(`${LANGUAGE_LABELS[language]} saved`);
      });
    },
    [drafts, eventId, problem.id],
  );

  // Cmd/Ctrl+S saves the currently active language tab
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) {
          save(active);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, save, saving]);

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div>
        <h3 className="text-sm font-medium">Starter code and harness</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Each language needs a complete file and the hidden snippet appended
          at run time. Both are yours to edit.
        </p>
      </div>

      <Tabs
        className="mt-4"
        value={active}
        onValueChange={(value) => {
          if (isLanguage(value)) setActive(value);
        }}
      >
        <TabsList aria-label="Language">
          {LANGUAGES.map((language) => {
            const dirty = !samePair(drafts[language], saved[language]);
            return (
              <TabsTrigger
                key={language}
                value={language}
                className="relative gap-1.5"
              >
                <span>{LANGUAGE_LABELS[language]}</span>
                {dirty && (
                  <span
                    data-slot="unsaved-dot"
                    className="size-1.5 rounded-full bg-amber-500 animate-in fade-in"
                    title="Unsaved changes"
                    aria-label="Unsaved changes"
                  />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {LANGUAGES.map((language) => {
          const dirty = !samePair(drafts[language], saved[language]);
          const isSavingThis = saving && pendingLanguage === language;

          return (
            <TabsContent key={language} value={language} className="mt-3">
              <LanguagePairFields
                problemId={problem.id}
                language={language}
                value={drafts[language]}
                onChange={(change) => patch(language, change)}
                onSave={() => {
                  if (!saving) save(language);
                }}
              />

              {error?.language === language ? (
                <Alert variant="destructive" className="mt-3">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ) : null}

              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Saved only while the event is a draft.
                </p>
                <Button
                  size="sm"
                  onClick={() => save(language)}
                  disabled={!dirty || saving}
                >
                  {isSavingThis
                    ? "Saving…"
                    : `Save ${LANGUAGE_LABELS[language]}`}
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </section>
  );
}
