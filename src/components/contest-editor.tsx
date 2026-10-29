"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { installEditorGuards } from "@/components/editor-guards";
import { useAntiCheat } from "@/components/use-anti-cheat";
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
 *
 * Pasting is blocked on every route into the editor (SPEC §6): Monaco's paste
 * command and the shortcut are replaced, the context menu is off, and the DOM
 * node rejects paste, drop, and middle click. Copying out is untouched. The
 * guards live for as long as the editor does, so switching Problem or language
 * does not leak listeners.
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
  joinCode,
  problemId,
  language,
  defaultValue,
  onChange,
}: {
  joinCode: string;
  problemId: string;
  language: Language;
  defaultValue: string;
  onChange: (code: string) => void;
}) {
  const report = useAntiCheat({ code: joinCode });
  const guardsRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      guardsRef.current?.();
      guardsRef.current = null;
    },
    [],
  );

  const onMount: OnMount = (editor, monaco) => {
    guardsRef.current?.();
    guardsRef.current = installEditorGuards({
      editor,
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV,
      report,
    });
    editor.focus();
  };

  return (
    <MonacoEditor
      path={`problem-${problemId}.${EXTENSIONS[language]}`}
      language={language}
      defaultValue={defaultValue}
      theme="vs-dark"
      onChange={(value) => onChange(value ?? "")}
      onMount={onMount}
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
        contextmenu: false,
        dragAndDrop: false,
        dropIntoEditor: { enabled: false },
      }}
    />
  );
}
