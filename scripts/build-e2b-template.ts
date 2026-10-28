import "./load-env";
import { resolve } from "node:path";
import { Template, defaultBuildLogger } from "e2b";
import { e2bApiKey } from "../src/lib/env";

/**
 * Builds the Code Feast sandbox template from `e2b/Dockerfile` and prints its
 * id. The id is what `E2B_TEMPLATE_ID` must be set to; the default E2B template
 * has no JDK, so without this Java cannot compile.
 *
 *   npm run e2b:build
 *
 * Reads the key through `src/lib/env.ts` like the app does, and never prints
 * it. The build is deliberate and repeatable: running it again rebuilds the
 * same template name and prints the new id.
 */

const TEMPLATE_NAME = "code-feast";

/** 2 vCPU / 2 GiB: the stock 512 MiB sandbox cannot start a JVM. */
const CPU_COUNT = 2;
const MEMORY_MB = 2048;

async function main() {
  const apiKey = e2bApiKey();
  if (!apiKey) {
    throw new Error(
      "E2B_API_KEY is not set. Add it to .env.local (see .env.example).",
    );
  }

  const template = Template({ fileContextPath: resolve("e2b") }).fromDockerfile(
    resolve("e2b/Dockerfile"),
  );

  const info = await Template.build(template, TEMPLATE_NAME, {
    apiKey,
    cpuCount: CPU_COUNT,
    memoryMB: MEMORY_MB,
    onBuildLogs: defaultBuildLogger({ minLevel: "info" }),
  });

  console.log("");
  console.log(`Template name: ${info.name}`);
  console.log(`Template id:   ${info.templateId}`);
  console.log(`Build id:      ${info.buildId}`);
  console.log("");
  console.log(`Set E2B_TEMPLATE_ID="${info.templateId}"`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
