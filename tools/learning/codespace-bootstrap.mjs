import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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
const evidenceFile = path.join(cacheDir, "codespace-evidence.md");

function git(args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(cacheDir, { recursive: true });

  const { manifest, cards } = await loadLearningModel();
  const model = validateLearningModel(manifest, cards);

  const download = await downloadDocuments(manifest, pdfDir, { concurrency: 3 });
  const failedDocuments = download.results
    .filter(item => item.status === "FAIL")
    .map(item => ({ id: item.id, error: item.error, sourceFailures: item.sourceFailures ?? [] }));

  const state = await loadState(stateFile);
  const date = new Date().toISOString().slice(0, 10);
  const plan = buildPlan(cards.cards, state, date);
  const session = renderSession(plan, manifest);
  await writeFile(sessionFile, session, "utf8");

  const gitHead = git(["rev-parse", "HEAD"]);
  const gitBranch = git(["branch", "--show-current"]);
  const report = {
    generatedAt: new Date().toISOString(),
    execution: "github-codespaces",
    gitHead,
    gitBranch,
    node: process.version,
    documents: {
      requested: download.requested,
      passed: download.passed,
      failed: download.failed,
      failedDocuments,
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

  const evidence = [
    "# TI Learning Codespace Evidence",
    "",
    `- generated: ${report.generatedAt}`,
    `- branch: ${gitBranch ?? "unknown"}`,
    `- HEAD: ${gitHead ?? "unknown"}`,
    `- Node: ${process.version}`,
    `- TI PDFs: ${download.passed}/${download.requested} PASS`,
    ...(failedDocuments.length
      ? [`- Failed documents: ${failedDocuments.map(item => item.id).join(", ")}`]
      : []),
    `- Concept Cards: ${model.conceptCount}`,
    `- Session: ${path.relative(root, sessionFile)}`,
    `- Download report: ${path.relative(root, path.join(pdfDir, "download-report.json"))}`,
    "",
    download.failed === 0 ? "BOOTSTRAP_PASS" : "BOOTSTRAP_FAIL",
    ""
  ].join("\n");
  await writeFile(evidenceFile, evidence, "utf8");

  console.log(JSON.stringify(report, null, 2));
  console.log("\n" + evidence);

  if (download.failed) {
    throw new Error(`TI download incomplete: ${download.passed}/${download.requested} passed; failed: ${failedDocuments.map(item => item.id).join(", ")}`);
  }
}

main().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
