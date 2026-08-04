import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const failures = [];
const warnings = [];
const privatePatterns = [
  /ASR[- ]?5075/i,
  /00\.ASR/i,
  /circuit2026/i,
  /id=["']auth-overlay["']/i,
  /私人專案防護/
];

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function walk(dir) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full));
    else output.push(full);
  }
  return output;
}

function htmlMarkupOnly(text) {
  return text.replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, (match, attributes) => `<script${attributes}></script>`);
}

function localTarget(file, reference) {
  const trimmed = reference.trim();
  if (!trimmed || /^(#|javascript:|mailto:|tel:|data:|blob:|https?:|\/\/)/i.test(trimmed)) return null;
  const withoutSuffix = trimmed.split(/[?#]/, 1)[0];
  if (!withoutSuffix || withoutSuffix.includes("${")) return null;
  let decoded = withoutSuffix;
  try { decoded = decodeURIComponent(withoutSuffix); } catch (error) {}
  if (decoded.startsWith("/Circuit-Simulation/")) decoded = decoded.slice("/Circuit-Simulation/".length);
  else if (decoded.startsWith("/")) decoded = decoded.slice(1);
  return path.resolve(path.dirname(file), decoded);
}

function checkReferences(file, text) {
  const refs = [];
  if (file.endsWith(".html")) {
    const markup = htmlMarkupOnly(text);
    for (const match of markup.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) refs.push(match[1]);
    for (const match of markup.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.push(match[1]);
  } else if (file.endsWith(".css")) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) refs.push(match[1]);
  } else {
    return;
  }
  for (const ref of refs) {
    const target = localTarget(file, ref);
    if (target && !fs.existsSync(target)) failures.push(`${relative(file)} -> missing ${ref}`);
  }
}

function checkDuplicateIds(file, text) {
  if (!file.endsWith(".html")) return;
  const seen = new Set();
  const markup = htmlMarkupOnly(text);
  for (const match of markup.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
    const id = match[1];
    if (seen.has(id)) failures.push(`${relative(file)} -> duplicate id ${id}`);
    seen.add(id);
  }
}

function checkPrivateMarkers(file, text) {
  if (relative(file).startsWith("tools/validate-project")) return;
  for (const pattern of privatePatterns) {
    if (pattern.test(text)) failures.push(`${relative(file)} -> contains blocked private marker ${pattern}`);
  }
}

function checkJavaScript(files) {
  for (const file of files.filter(name => /\.(?:js|mjs)$/.test(name))) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) failures.push(`${relative(file)} -> JavaScript syntax: ${(result.stderr || result.stdout).trim()}`);
  }
}

function checkCurriculum() {
  const file = path.join(root, "assets/learning/curriculum.js");
  const context = { window: {} };
  context.window.window = context.window;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  const curriculum = context.window.CircuitCurriculum;
  if (!curriculum || !Array.isArray(curriculum.modules)) {
    failures.push("curriculum.js did not expose CircuitCurriculum.modules");
    return;
  }
  const ids = new Set();
  for (const module of curriculum.modules) {
    if (!module.id || ids.has(module.id)) failures.push(`curriculum duplicate or missing module id: ${module.id}`);
    ids.add(module.id);
    const base = module.entry.replace(/[^/]+$/, "");
    const refs = [module.entry];
    for (const lesson of module.lessons || []) refs.push(base + lesson[0]);
    for (const lab of module.labs || []) refs.push(lab[2]);
    for (const fault of module.faults || []) refs.push(fault[4]);
    for (const ref of refs) if (!fs.existsSync(path.join(root, ref))) failures.push(`curriculum ${module.id} -> missing ${ref}`);
  }
}

function checkTutorInjection(files) {
  const formalRoot = /^(0_buck_converter_|1_c2000_adc_calculator|2_code_artifact|3_foc_course|4_PI|5_spi|6\.10μs 高頻控制迴路模擬器|7\.28388d_bms_tutorial|8\.ad5543_simulator|9\.afe-tutorial|10\.acmc-pro_power_simulator|11\.c2000_dds_dashboard)\//;
  for (const file of files.filter(name => name.endsWith(".html"))) {
    const rel = relative(file);
    if (!formalRoot.test(rel) || /\/(legacy|originals)\//.test(rel)) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("data-circuit-tutor-css") || !text.includes("data-circuit-tutor-js")) warnings.push(`${rel} -> tutor injection missing`);
  }
}

const files = walk(root);
for (const file of files) {
  if (!/\.(?:html|css|js|mjs|md|yml|yaml)$/.test(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  checkReferences(file, text);
  checkDuplicateIds(file, text);
  checkPrivateMarkers(file, text);
}
checkJavaScript(files);
checkCurriculum();
checkTutorInjection(files);

if (warnings.length) {
  console.warn("Warnings:");
  warnings.forEach(item => console.warn("- " + item));
}
if (failures.length) {
  console.error(`Validation failed with ${failures.length} issue(s):`);
  failures.forEach(item => console.error("- " + item));
  process.exit(1);
}
console.log(`Validation passed: ${files.length} files scanned.`);
