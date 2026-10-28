import "./load-env";
import { randomUUID } from "node:crypto";
import { e2bTemplateId } from "../src/lib/env";
import {
  createE2BSandboxProvider,
  type SandboxHandle,
} from "../src/lib/runner/sandbox";

/**
 * Live check that `E2B_TEMPLATE_ID` can compile and run all three languages.
 *
 *   npm run e2b:check
 *
 * It goes through the app's own provider (`src/lib/runner/sandbox.ts`), so it
 * exercises the same create path a Run uses, and mirrors the compile/run
 * commands in `src/lib/runner/run.ts`. It is a live check against the real E2B
 * account, not a unit test: there is nothing to assert without the network, so
 * it prints the timings and exits non-zero if any language fails.
 *
 * Run it after building the template (scripts/build-e2b-template.ts) and again
 * after a deploy, to confirm the production `E2B_TEMPLATE_ID` is the JDK one.
 */

type Check = {
  fileName: string;
  source: string;
  compileCommand?: (dir: string) => string;
  runCommand: (dir: string) => string;
};

/** Mirrors LANGUAGE_RUNNERS in src/lib/runner/run.ts. */
const CHECKS: Record<string, Check> = {
  python: {
    fileName: "main.py",
    source: 'print("hello from python")\n',
    runCommand: (dir) => `python3 ${dir}/main.py`,
  },
  cpp: {
    fileName: "main.cpp",
    source: [
      "#include <iostream>",
      "int main() {",
      '  std::cout << "hello from cpp" << std::endl;',
      "  return 0;",
      "}",
      "",
    ].join("\n"),
    compileCommand: (dir) => `g++ -O2 -std=c++17 -o ${dir}/main ${dir}/main.cpp`,
    runCommand: (dir) => `${dir}/main`,
  },
  java: {
    fileName: "Main.java",
    source: [
      "public class Main {",
      "  public static void main(String[] args) {",
      '    System.out.println("hello from java");',
      "  }",
      "}",
      "",
    ].join("\n"),
    compileCommand: (dir) => `javac -d ${dir} ${dir}/Main.java`,
    runCommand: (dir) => `java -Xmx512m -cp ${dir} Main`,
  },
};

async function checkLanguage(
  handle: SandboxHandle,
  language: string,
  check: Check,
): Promise<{ language: string; ok: boolean; compileMs: number | null; runMs: number; output: string }> {
  const dir = `/work/check-${language}-${randomUUID()}`;
  await handle.run(`mkdir -p ${dir}`, { timeoutMs: 5_000 });
  await handle.writeFile(`${dir}/${check.fileName}`, check.source);

  let compileMs: number | null = null;
  if (check.compileCommand) {
    const compiled = await handle.run(check.compileCommand(dir), {
      timeoutMs: 15_000,
    });
    compileMs = compiled.ms;
    if (compiled.exitCode !== 0) {
      return {
        language,
        ok: false,
        compileMs,
        runMs: 0,
        output: (compiled.stderr || compiled.stdout).trim(),
      };
    }
  }

  const ran = await handle.run(check.runCommand(dir), { timeoutMs: 15_000 });
  return {
    language,
    ok: ran.exitCode === 0,
    compileMs,
    runMs: ran.ms,
    output: (ran.stdout || ran.stderr).trim(),
  };
}

async function main() {
  const template = e2bTemplateId();
  console.log(`Template: ${template ?? "(E2B default: no JDK)"}`);

  const provider = createE2BSandboxProvider();
  const handle = await provider.create();
  console.log(`Sandbox:  ${handle.id}`);

  try {
    const tools = await handle.run(
      "python3 --version; g++ --version | head -1; javac -version; java -version 2>&1 | head -1",
      { timeoutMs: 15_000 },
    );
    console.log(tools.stdout.trim());
    console.log("");

    let failed = false;
    for (const [language, check] of Object.entries(CHECKS)) {
      const result = await checkLanguage(handle, language, check);
      const compile =
        result.compileMs === null ? "no compile" : `compile ${result.compileMs}ms`;
      console.log(
        `${result.ok ? "ok  " : "FAIL"} ${language.padEnd(6)} ${compile.padEnd(16)} run ${result.runMs}ms  ${JSON.stringify(result.output)}`,
      );
      if (!result.ok) failed = true;
    }

    if (failed) process.exitCode = 1;
  } finally {
    await handle.kill().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
