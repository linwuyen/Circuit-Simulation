(function attachSchema(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.CircuitSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSchema() {
  "use strict";

  const VERSION = 3;

  const text = (value, fallback = "") =>
    String(value == null ? "" : value).trim() || fallback;

  const slug = value =>
    text(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "item";

  const directoryOf = entry => text(entry).replace(/[^/]+$/, "");

  const resolvePath = (base, href) => {
    const value = text(href);
    if (
      !value ||
      /^(?:https?:|data:|#|\/)/i.test(value) ||
      value.startsWith(base)
    ) {
      return value;
    }
    return base + value;
  };

  function sourceObject(raw, kind) {
    if (!Array.isArray(raw)) {
      return raw || {};
    }
    if (kind === "lesson") {
      return {
        href: raw[0],
        title: raw[1],
        objective: raw[2],
        action: raw[3],
        expectedObservation: raw[4]
      };
    }
    if (kind === "lab") {
      return {
        id: raw[0],
        title: raw[1],
        href: raw[2],
        task: raw[3],
        success: raw[4],
        value: raw[5]
      };
    }
    return {
      symptom: raw[0],
      cause: raw[1],
      verify: raw[2],
      fix: raw[3],
      href: raw[4]
    };
  }

  function identity(moduleId, kind, source, index) {
    const explicit = text(source.id);
    if (explicit) {
      return explicit.includes(".")
        ? explicit
        : `${moduleId}.${kind}.${slug(explicit)}`;
    }

    const semantic =
      kind === "lesson"
        ? source.title
        : kind === "lab"
          ? source.title || source.task
          : source.symptom || source.title;

    return `${moduleId}.${kind}.${slug(semantic || `item-${index + 1}`)}`;
  }

  function legacyIdentity(moduleId, kind, source, index) {
    const anchor =
      kind === "lesson"
        ? source.href || source.title
        : kind === "lab"
          ? source.id || source.href || source.title
          : source.symptom || source.href;

    return `${moduleId}.${kind}.${slug(anchor || `item-${index + 1}`)}`;
  }

  function normalizeLesson(moduleId, base, raw, index) {
    const source = sourceObject(raw, "lesson");
    const id = identity(moduleId, "lesson", source, index);

    return {
      id,
      legacyIds: [
        legacyIdentity(moduleId, "lesson", source, index),
        `${moduleId}:lesson:${index}`
      ],
      localId: id.split(".").slice(2).join("."),
      href: resolvePath(base, source.href || source.path || source.file),
      title: text(source.title, "未命名課程"),
      objective: text(source.objective || source.goal),
      action: text(source.action),
      expectedObservation: text(
        source.expectedObservation || source.result || source.interpretation
      ),
      competency: text(
        source.competency,
        `${moduleId}.${slug(source.title || id)}`
      ),
      prerequisites: Array.isArray(source.prerequisites)
        ? source.prerequisites.slice()
        : [],
      modelId: text(source.modelId),
      assumptions: Array.isArray(source.assumptions)
        ? source.assumptions.slice()
        : []
    };
  }

  function normalizeLab(moduleId, raw, index) {
    const source = sourceObject(raw, "lab");
    const id = identity(moduleId, "lab", source, index);

    return {
      id,
      legacyIds: [
        legacyIdentity(moduleId, "lab", source, index),
        `${moduleId}.lab.${slug(source.id || source.href || source.title)}`
      ],
      localId: text(source.id, slug(source.title || `lab-${index + 1}`)),
      title: text(source.title, "未命名實驗"),
      href: text(source.href || source.path),
      task: text(source.task || source.objective),
      success: text(source.success || source.acceptance),
      value: text(source.value || source.whyUseful),
      competency: text(
        source.competency,
        `${moduleId}.lab.${slug(source.title || source.id || index)}`
      ),
      transferPrompt: text(
        source.transferPrompt,
        "換一組參數後，原本結論是否仍成立？為什麼？"
      )
    };
  }

  function normalizeFault(moduleId, raw, index) {
    const source = sourceObject(raw, "fault");
    const id = identity(moduleId, "fault", source, index);

    return {
      id,
      legacyIds: [legacyIdentity(moduleId, "fault", source, index)],
      localId: id.split(".").slice(2).join("."),
      symptom: text(source.symptom, "未命名症狀"),
      cause: text(source.cause),
      verify: text(source.verify),
      fix: text(source.fix),
      href: text(source.href || source.path),
      competency: text(
        source.competency,
        `${moduleId}.fault.${slug(source.symptom || index)}`
      )
    };
  }

  function normalizeModule(raw, index) {
    const id = text(raw.id, slug(raw.title || `module-${index + 1}`));
    const base = directoryOf(raw.entry);

    return {
      id,
      number: text(raw.number, String(index + 1)),
      tag: text(raw.tag, id.toUpperCase()),
      title: text(raw.title, "未命名主題"),
      entry: text(raw.entry),
      oneLine: text(raw.oneLine),
      analogy: text(raw.analogy),
      whyUseful: text(raw.whyUseful),
      prerequisites: Array.isArray(raw.prerequisites)
        ? raw.prerequisites.slice()
        : [],
      lessons: (raw.lessons || []).map((item, itemIndex) =>
        normalizeLesson(id, base, item, itemIndex)
      ),
      labs: (raw.labs || []).map((item, itemIndex) =>
        normalizeLab(id, item, itemIndex)
      ),
      faults: (raw.faults || []).map((item, itemIndex) =>
        normalizeFault(id, item, itemIndex)
      )
    };
  }

  function normalizeCurriculum(raw) {
    const modules = (raw && raw.modules ? raw.modules : []).map(normalizeModule);
    const moduleById = Object.fromEntries(
      modules.map(module => [module.id, module])
    );
    const allItems = modules.flatMap(module => [
      ...module.lessons,
      ...module.labs,
      ...module.faults
    ]);
    const itemById = Object.fromEntries(allItems.map(item => [item.id, item]));
    const legacyIdMap = {};

    allItems.forEach(item => {
      (item.legacyIds || []).forEach(id => {
        if (id) {
          legacyIdMap[id] = item.id;
        }
      });
    });

    return {
      version: VERSION,
      modules,
      moduleById,
      itemById,
      legacyIdMap,
      glossary: (raw && raw.glossary) || []
    };
  }

  function resolveLegacyId(curriculum, id) {
    return curriculum.itemById[id]
      ? id
      : curriculum.legacyIdMap[id] || id;
  }

  function migrateLegacyDone(raw, done) {
    const curriculum = normalizeCurriculum(raw);
    const migrated = {};

    Object.entries(done || {}).forEach(([id, value]) => {
      migrated[resolveLegacyId(curriculum, id)] = value;
    });
    return migrated;
  }

  function validate(raw) {
    const curriculum = normalizeCurriculum(raw);
    const errors = [];
    const ids = new Set();

    curriculum.modules.forEach(module => {
      if (!module.id || !module.entry) {
        errors.push(`module missing id/entry: ${module.title}`);
      }

      [...module.lessons, ...module.labs, ...module.faults].forEach(item => {
        if (ids.has(item.id)) {
          errors.push(`duplicate id: ${item.id}`);
        }
        ids.add(item.id);
        if (!item.href) {
          errors.push(`missing href: ${item.id}`);
        }
      });
    });
    return errors;
  }

  return {
    VERSION,
    slug,
    normalizeCurriculum,
    resolveLegacyId,
    migrateLegacyDone,
    validate
  };
});
