"use client";

import dynamic from "next/dynamic";
import type { Language } from "@/lib/languages";
import { Spinner } from "@/components/ui/spinner";

/**
 * Monaco, loaded only in the browser. The lobby has already warmed the bundle
 * (ticket 07), so this normally paints immediately.
 *
 * The editor is uncontrolled: `defaultValue` seeds a model and the buffer is
 * never written back through `value`. That is deliberate — a controlled editor
 * resets the undo stack on every autosave. One model per Problem + language
 * (via `path`) also gives each language its own undo history and scroll.
 */

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading editor
      </div>
    ),
  },
);

const EXTENSIONS: Record<Language, string> = {
  python: "py",
  java: "java",
  cpp: "cpp",
};

export function ContestEditor({
  problemId,
  language,
  defaultValue,
  onChange,
}: {
  problemId: string;
  language: Language;
  defaultValue: string;
  onChange: (code: string) => void;
}) {
  return (
    <MonacoEditor
      path={`problem-${problemId}.${EXTENSIONS[language]}`}
      language={language}
      defaultValue={defaultValue}
      theme="vs-dark"
      onChange={(value) => onChange(value ?? "")}
      onMount={(editor) => editor.focus()}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        lineHeight: 20,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        automaticLayout: true,
        scrollBeyondLastLine: false,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: "line",
        tabSize: 4,
        wordWrap: "off",
        smoothScrolling: true,
      }}
    />
  );
}
