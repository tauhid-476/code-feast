"use client";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Spinner } from "@/components/ui/spinner";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        Loading editor
      </div>
    ),
  },
);

const EXTENSIONS: Record<string, string> = {
  python: "py",
  java: "java",
  cpp: "cpp",
};

export function ReviewCodeEditor({
  code,
  language,
  problemId,
}: {
  code: string;
  language: string;
  problemId: string;
}) {
  const { resolvedTheme } = useTheme();
  const ext = EXTENSIONS[language] ?? "txt";

  return (
    <div className="relative h-[380px] w-full overflow-hidden rounded-md border border-border bg-card">
      <MonacoEditor
        path={`review-${problemId}.${ext}`}
        language={language === "cpp" ? "cpp" : language}
        value={code}
        theme={resolvedTheme === "light" ? "light" : "vs-dark"}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: "none",
          tabSize: 4,
          wordWrap: "off",
          contextmenu: true,
        }}
      />
    </div>
  );
}
