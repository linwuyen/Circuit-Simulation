import { mkdir, writeFile } from "node:fs/promises";\nimport { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { downloadDocuments } from "./ti-docs.mjs";
import {
  buildPlan,
  loadLearningModel,
  loadState,
  renderSession,
  validateLearningModel
} from "./engineering-learning.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cacheDir = path.join(root, ".learning-cache");
const pdfDir = path.join(cacheDir, "ti");
const stateFile = path.join(cacheDir, "learning-state.json");
const sessionFile = path.join(cacheDir, "today-session.md");
const reportFile = path.join(cacheDir, "codespace-bootstrap-report.json");

async function main() {
  await mkdir(cacheDir, { recursive: true });

  const { manifest, cards } = await loadLearningModel();
  const model = validateLearningModel(manifest, cards);

  const download = await downloadDocuments(manifest, pdfDir, { concurrency: 3 });
  if (download.failed) {
    throw new Error(`TI download incomplete: ${download.passed}/${download.requested} passed`);
  }

  const state = await loadState(stateFile);
  const date = new Date().toISOString().slice(0, 10);
  const plan = buildPlan(cards.cards, state, date);
  const session = renderSession(plan, manifest);
  await writeFile(sessionFile, session, "utf8");

  const report = {
    generatedAt: new Date().toISOString(),
    execution: "github-codespaces",
    documents: {
      requested: download.requested,
      passed: download.passed,
      failed: download.failed,
      report: path.relative(root, path.join(pdfDir, "download-report.json"))
    },
    learningModel: model,
    session: {
      date: plan.date,
      dueCount: plan.dueCount,
      newCount: plan.newCount,
      file: path.relative(root, sessionFile)
    }
  };

  await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  console.log("\nCodespace bootstrap PASS");
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
