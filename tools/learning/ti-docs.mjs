import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const defaultManifest = path.join(root, "learning/ti/manifest.json");

function isOfficialTiHost(hostname) {
  const host = String(hostname || "").toLowerCase();
  return host === "ti.com" || host.endsWith(".ti.com");
}

export async function loadManifest(file = defaultManifest) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function sourceUrls(doc) {
  return [doc.url, ...(doc.fallbackUrls ?? [])].filter(Boolean);
}

export function validateManifest(manifest) {
  if (manifest?.version !== 1 || !Array.isArray(manifest.documents)) throw new Error("manifest version/documents invalid");
  const ids = new Set();
  const files = new Set();
  for (const doc of manifest.documents) {
    for (const key of ["id", "title", "track", "url", "file"]) if (!doc[key]) throw new Error(`document missing ${key}`);
    if (ids.has(doc.id)) throw new Error(`duplicate document id: ${doc.id}`);
    if (files.has(doc.file)) throw new Error(`duplicate document file: ${doc.file}`);
    ids.add(doc.id); files.add(doc.file);
    for (const value of sourceUrls(doc)) {
      const url = new URL(value);
      if (url.protocol !== "https:") throw new Error(`non-HTTPS source: ${doc.id}`);
      if (!isOfficialTiHost(url.hostname)) throw new Error(`non-official TI host: ${doc.id}: ${url.hostname}`);
    }
    if (!doc.file.toLowerCase().endsWith(".pdf")) throw new Error(`non-PDF filename: ${doc.id}`);
  }
  return { documentCount: manifest.documents.length, ids: [...ids] };
}

async function fetchOnePdf(url, { timeoutMs = 45000, retries = 2 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "Circuit-Simulation engineering-learning/1.0" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const final = new URL(response.url);
      if (!isOfficialTiHost(final.hostname)) throw new Error(`redirected off TI domain: ${final.hostname}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 10000) throw new Error(`unexpectedly small file (${bytes.length} bytes)`);
      if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("payload is not a PDF");
      return {
        bytes,
        requestedUrl: url,
        finalUrl: response.url,
        contentType: response.headers.get("content-type"),
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchPdf(doc, options) {
  const failures = [];
  for (const url of sourceUrls(doc)) {
    try {
      const result = await fetchOnePdf(url, options);
      return { ...result, sourceFailures: failures };
    } catch (error) {
      failures.push({ url, error: String(error?.message ?? error) });
    }
  }
  const error = new Error(`all TI sources failed for ${doc.id}`);
  error.sourceFailures = failures;
  throw error;
}

export async function downloadDocuments(manifest, outDir, { concurrency = 3 } = {}) {
  validateManifest(manifest);
  await mkdir(outDir, { recursive: true });
  const queue = [...manifest.documents];
  const results = [];
  async function worker() {
    while (queue.length) {
      const doc = queue.shift();
      const destination = path.join(outDir, doc.file);
      const temp = destination + ".tmp";
      const started = Date.now();
      try {
        const { bytes, requestedUrl, finalUrl, contentType, attempts, sourceFailures } = await fetchPdf(doc);
        await writeFile(temp, bytes);
        await rename(temp, destination);
        results.push({
          id: doc.id,
          file: doc.file,
          status: "PASS",
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          requestedUrl,
          finalUrl,
          contentType,
          attempts,
          sourceFailures,
          elapsedMs: Date.now() - started
        });
      } catch (error) {
        await rm(temp, { force: true });
        results.push({
          id: doc.id,
          file: doc.file,
          status: "FAIL",
          error: String(error?.message ?? error),
          sourceFailures: error?.sourceFailures ?? [],
          elapsedMs: Date.now() - started
        });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, 8)) }, () => worker()));
  results.sort((a, b) => a.id.localeCompare(b.id));
  const report = {
    generatedAt: new Date().toISOString(),
    requested: manifest.documents.length,
    passed: results.filter(x => x.status === "PASS").length,
    failed: results.filter(x => x.status === "FAIL").length,
    results
  };
  await writeFile(path.join(outDir, "download-report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const command = process.argv[2] ?? "validate";
  const manifest = await loadManifest(arg("--manifest", defaultManifest));
  if (command === "validate") {
    console.log(JSON.stringify(validateManifest(manifest), null, 2));
    return;
  }
  if (command === "list") {
    validateManifest(manifest);
    for (const doc of manifest.documents) console.log(`${doc.id}\t${doc.track}\t${doc.title}\t${sourceUrls(doc).join(" | ")}`);
    return;
  }
  if (command === "download") {
    const outDir = path.resolve(arg("--out", path.join(root, manifest.policy?.cacheDir ?? ".learning-cache/ti")));
    const report = await downloadDocuments(manifest, outDir, { concurrency: Number(arg("--concurrency", "3")) });
    console.log(JSON.stringify({ outDir, requested: report.requested, passed: report.passed, failed: report.failed }, null, 2));
    if (report.failed) process.exitCode = 1;
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.stack || error); process.exit(1); });
}
