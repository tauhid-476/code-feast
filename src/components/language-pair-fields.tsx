"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Field, FieldDescription, FieldLabel } from "@/components/legacy-ui/field";
import { Spinner } from "@/components/legacy-ui/spinner";
import { LANGUAGE_LABELS, type Language } from "@/lib/languages";

export type StarterPairDraft = {
  starterCode: string;
  harnessCode: string;
};

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => <EditorSkeleton />,
  },
);

function EditorSkeleton() {
  return (
    <div className="relative flex h-[320px] w-full flex-col justify-between overflow-hidden rounded-md border border-border bg-card p-4 animate-pulse">
      <div className="space-y-2.5">
        <div className="h-3.5 w-1/4 rounded bg-muted" />
        <div className="h-3.5 w-3/5 rounded bg-muted/80" />
        <div className="h-3.5 w-1/2 rounded bg-muted/60" />
        <div className="h-3.5 w-2/3 rounded bg-muted/70" />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        <span>Loading editor…</span>
      </div>
    </div>
  );
}

const MONACO_LANGUAGES: Record<Language, string> = {
  python: "python",
  java: "java",
  cpp: "cpp",
};

const EXTENSIONS: Record<Language, string> = {
  python: "py",
  java: "java",
  cpp: "cpp",
};

function AdminCodeEditor({
  problemId,
  field,
  language,
  defaultValue,
  placeholder,
  onChange,
  onSave,
}: {
  problemId: string;
  field: "starter" | "harness";
  language: Language;
  defaultValue: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSave?: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const [isEmpty, setIsEmpty] = useState(() => (defaultValue ?? "").length === 0);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const modelPath = `problem-${problemId}-${field}-${language}.${EXTENSIONS[language]}`;

  const onMount: OnMount = (editor, monaco) => {
    setIsEmpty(editor.getValue().length === 0);

    editor.onDidChangeModelContent(() => {
      setIsEmpty(editor.getValue().length === 0);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current?.();
    });
  };

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-md border border-border bg-card transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/40">
      {isEmpty && (
        <div className="pointer-events-none absolute left-[54px] top-[14px] z-10 select-none font-mono text-[13px] leading-[20px] text-muted-foreground/40">
          {placeholder}
        </div>
      )}
      <MonacoEditor
        height="320px"
        path={modelPath}
        language={MONACO_LANGUAGES[language]}
        defaultValue={defaultValue}
        theme={resolvedTheme === "light" ? "light" : "vs-dark"}
        onChange={(val) => {
          const text = val ?? "";
          setIsEmpty(text.length === 0);
          onChange(text);
        }}
        onMount={onMount}
        options={{
          minimap: { enabled: false },
          lineNumbers: "on",
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "var(--font-mono), ui-monospace, monospace",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: "line",
          tabSize: 4,
          wordWrap: "off",
          smoothScrolling: true,
          contextmenu: true,
        }}
      />
    </div>
  );
}

/**
 * The two editable halves of one language with Monaco code editors.
 * Each language and field uses its own model path to preserve content and undo history.
 * Both columns are vertically aligned so the editors start at the exact same level.
 */
export function LanguagePairFields({
  problemId = "default",
  language,
  value,
  onChange,
  onSave,
}: {
  problemId?: string;
  language: Language;
  value: StarterPairDraft;
  onChange: (patch: Partial<StarterPairDraft>) => void;
  onSave?: () => void;
}) {
  const label = LANGUAGE_LABELS[language];
  const starterPlaceholder = `// The complete ${label} file, with the function to complete.`;
  const harnessPlaceholder = `// The ${label} snippet appended after the participant's code.`;

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
      <Field className="lg:grid lg:grid-rows-subgrid lg:row-span-2">
        <div className="flex flex-col gap-1 lg:min-h-[4.25rem]">
          <FieldLabel htmlFor={`starter-${language}`}>Starter Code</FieldLabel>
          <FieldDescription>
            The whole file a participant opens for {label}, including the signed
            function.
          </FieldDescription>
        </div>
        <div className="w-full">
          <AdminCodeEditor
            key={`starter-${language}`}
            problemId={problemId}
            field="starter"
            language={language}
            defaultValue={value.starterCode}
            placeholder={starterPlaceholder}
            onChange={(starterCode) => onChange({ starterCode })}
            onSave={onSave}
          />
          {/* Fallback accessible element for SSR/tests */}
          <textarea
            id={`starter-${language}`}
            value={value.starterCode}
            onChange={(event) => onChange({ starterCode: event.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </Field>

      <Field className="lg:grid lg:grid-rows-subgrid lg:row-span-2">
        <div className="flex flex-col gap-1 lg:min-h-[4.25rem]">
          <FieldLabel htmlFor={`harness-${language}`}>Harness</FieldLabel>
          <FieldDescription>
            Hidden from participants and appended to their code at run time. It
            parses stdin and calls their function.
          </FieldDescription>
        </div>
        <div className="w-full">
          <AdminCodeEditor
            key={`harness-${language}`}
            problemId={problemId}
            field="harness"
            language={language}
            defaultValue={value.harnessCode}
            placeholder={harnessPlaceholder}
            onChange={(harnessCode) => onChange({ harnessCode })}
            onSave={onSave}
          />
          {/* Fallback accessible element for SSR/tests */}
          <textarea
            id={`harness-${language}`}
            value={value.harnessCode}
            onChange={(event) => onChange({ harnessCode: event.target.value })}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </Field>
    </div>
  );
}
