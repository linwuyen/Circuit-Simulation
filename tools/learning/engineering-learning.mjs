import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifestPath = path.join(root, "learning/ti/manifest.json");
const cardsPath = path.join(root, "learning/ti/concept-cards.json");

const DAY = 86400000;
const resultPolicy = {
  fail: { score: 0.2, days: 1, levelDelta: -1 },
  partial: { score: 0.5, days: 3, levelDelta: 0 },
  pass: { score: 0.8, days: 7, levelDelta: 1 },
  transfer: { score: 1.0, days: 30, levelDelta: 2 }
};

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
function isoDay(value) { return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10); }
function addDays(date, days) { return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10); }

export async function loadLearningModel() {
  return { manifest: await readJson(manifestPath), cards: await readJson(cardsPath) };
}

export function validateLearningModel(manifest, cardBundle) {
  const sourceIds = new Set(manifest.documents.map(x => x.id));
  const ids = new Set();
  if (cardBundle?.version !== 1 || !Array.isArray(cardBundle.cards)) throw new Error("concept-card bundle invalid");
  for (const card of cardBundle.cards) {
    for (const key of ["id", "title", "problem", "model", "sourceIds", "questions"]) if (card[key] == null) throw new Error(`card ${card.id ?? "<unknown>"} missing ${key}`);
    if (ids.has(card.id)) throw new Error(`duplicate concept id: ${card.id}`);
    ids.add(card.id);
    for (const sourceId of card.sourceIds) if (!sourceIds.has(sourceId)) throw new Error(`card ${card.id} references unknown source ${sourceId}`);
    if (!Array.isArray(card.questions) || card.questions.length < 3) throw new Error(`card ${card.id} needs >=3 questions`);
    const modes = new Set(card.questions.map(q => q.mode));
    for (const mode of ["predict", "diagnose", "transfer"]) if (!modes.has(mode)) throw new Error(`card ${card.id} missing ${mode} question`);
  }
  for (const card of cardBundle.cards) for (const prereq of card.prerequisites ?? []) if (!ids.has(prereq)) throw new Error(`card ${card.id} unknown prerequisite ${prereq}`);
  return { documentCount: manifest.documents.length, conceptCount: cardBundle.cards.length };
}

export async function loadState(file) {
  try {
    const state = await readJson(file);
    if (state?.version !== 1 || typeof state.concepts !== "object") throw new Error("state invalid");
    return state;
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, concepts: {} };
    throw error;
  }
}

async function writeStateAtomic(file, state) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2) + "\n");
  await rename(temp, file);
}

function stateFor(state, id) {
  return state.concepts[id] ?? { level: 0, mastery: 0, attempts: 0, lastResult: null, lastReviewed: null, nextReview: null, history: [] };
}

function prereqsReady(card, state) {
  return (card.prerequisites ?? []).every(id => (state.concepts[id]?.mastery ?? 0) >= 0.5);
}

export function buildPlan(cards, state, date, { maxReviews = 3, maxNew = 1 } = {}) {
  date = isoDay(date);
  const due = cards
    .map(card => ({ card, s: stateFor(state, card.id) }))
    .filter(x => x.s.attempts > 0 && x.s.nextReview && x.s.nextReview <= date)
    .sort((a, b) => a.s.nextReview.localeCompare(b.s.nextReview) || a.s.mastery - b.s.mastery || a.card.id.localeCompare(b.card.id))
    .slice(0, maxReviews);
  const unseen = cards
    .map(card => ({ card, s: stateFor(state, card.id) }))
    .filter(x => x.s.attempts === 0 && prereqsReady(x.card, state))
    .slice(0, maxNew);
  const chosen = [...due.map(x => ({ type: "review", ...x })), ...unseen.map(x => ({ type: "new", ...x }))];
  return {
    date,
    dueCount: due.length,
    newCount: unseen.length,
    items: chosen.map(({ type, card, s }) => {
      const preferredMode = type === "new" ? "predict" : s.mastery >= 0.8 ? "transfer" : s.mastery >= 0.5 ? "diagnose" : "predict";
      const candidates = card.questions.filter(q => q.mode === preferredMode);
      const question = candidates[s.attempts % candidates.length] ?? card.questions[s.attempts % card.questions.length];
      return { type, conceptId: card.id, title: card.title, mastery: s.mastery, mode: question.mode, question: question.prompt, sourceIds: card.sourceIds, projectLinks: card.projectLinks ?? [] };
    })
  };
}

export function applyGrade(state, conceptId, result, date) {
  const policy = resultPolicy[result];
  if (!policy) throw new Error(`unsupported result: ${result}`);
  date = isoDay(date);
  const prev = stateFor(state, conceptId);
  const level = Math.max(0, Math.min(6, prev.level + policy.levelDelta));
  const next = {
    ...prev,
    level,
    mastery: policy.score,
    attempts: prev.attempts + 1,
    lastResult: result,
    lastReviewed: date,
    nextReview: addDays(date, policy.days),
    history: [...(prev.history ?? []), { date, result, mastery: policy.score }].slice(-20)
  };
  return { ...state, concepts: { ...state.concepts, [conceptId]: next } };
}

export function renderSession(plan, manifest) {
  const docs = new Map(manifest.documents.map(d => [d.id, d]));
  const lines = [
    "# Engineering Learning Session",
    "",
    `Date: ${plan.date}`,
    "",
    "Coach contract:",
    "- Ask one item at a time; do not reveal the answer before the learner predicts.",
    "- Grade reasoning, not wording: FAIL / PARTIAL / PASS / TRANSFER.",
    "- Separate physics, control, implementation/timing, and evidence.",
    "- If the answer is wrong, identify the broken causal link and ask one narrower corrective question.",
    "- Require a waveform/measurement prediction whenever practical.",
    "- Treat TI sources as authority for document claims; do not invent section/page references.",
    ""
  ];
  for (const [index, item] of plan.items.entries()) {
    lines.push(`## ${index + 1}. ${item.title} [${item.type}/${item.mode}]`);
    lines.push(`Question: ${item.question}`);
    lines.push(`Sources: ${item.sourceIds.map(id => { const d = docs.get(id); return d ? `${id} — ${d.title}` : id; }).join("; ")}`);
    if (item.projectLinks.length) lines.push(`Project mapping: ${item.projectLinks.join(", ")}`);
    lines.push("");
  }
  lines.push("After each answer, return only: grade, broken/missing causal links, one evidence check, and the next question.");
  return lines.join("\n") + "\n";
}

function arg(name, fallback) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; }

async function main() {
  const command = process.argv[2] ?? "validate";
  const { manifest, cards } = await loadLearningModel();
  const valid = validateLearningModel(manifest, cards);
  if (command === "validate") { console.log(JSON.stringify(valid, null, 2)); return; }
  const stateFile = path.resolve(arg("--state", path.join(root, ".learning-cache/learning-state.json")));
  const date = arg("--date", new Date().toISOString().slice(0, 10));
  const state = await loadState(stateFile);
  if (command === "plan") { console.log(JSON.stringify(buildPlan(cards.cards, state, date), null, 2)); return; }
  if (command === "session") { console.log(renderSession(buildPlan(cards.cards, state, date), manifest)); return; }
  if (command === "grade") {
    const conceptId = arg("--concept"); const result = arg("--result");
    if (!conceptId || !cards.cards.some(c => c.id === conceptId)) throw new Error("--concept must name a known concept");
    const next = applyGrade(state, conceptId, result, date);
    await writeStateAtomic(stateFile, next);
    console.log(JSON.stringify(next.concepts[conceptId], null, 2));
    return;
  }
  throw new Error(`unknown command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.stack || error); process.exit(1); });
}
