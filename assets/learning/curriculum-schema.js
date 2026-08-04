(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitSchema = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 2;

  function text(value, fallback) {
    const result = String(value == null ? "" : value).trim();
    return result || (fallback || "");
  }

  function slug(value) {
    return text(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function directoryOf(entry) {
    const value = text(entry);
    return value.replace(/[^/]+$/, "");
  }

  function resolveLessonHref(base, href) {
    const value = text(href);
    if (!value || /^(?:https?:|data:|#|\/)/i.test(value)) return value;
    if (base && value.startsWith(base)) return value;
    return base + value;
  }

  function normalizeLesson(moduleId, base, raw, index) {
    const source = Array.isArray(raw) ? {
      href: raw[0],
      title: raw[1],
      objective: raw[2],
      action: raw[3],
      expectedObservation: raw[4]
    } : (raw || {});
    const href = text(source.href || source.path || source.file);
    const localId = text(source.id, slug(href || source.title || ("lesson-" + index)));
    return {
      id: moduleId + ".lesson." + localId,
      localId,
      href: resolveLessonHref(base, href),
      title: text(source.title, "未命名課程"),
      objective: text(source.objective || source.goal),
      action: text(source.action),
      expectedObservation: text(source.expectedObservation || source.result || source.interpretation),
      competency: text(source.competency, moduleId + "." + slug(source.title || localId)),
      prerequisites: Array.isArray(source.prerequisites) ? source.prerequisites.slice() : [],
      modelId: text(source.modelId),
      assumptions: Array.isArray(source.assumptions) ? source.assumptions.slice() : []
    };
  }

  function normalizeLab(moduleId, raw, index) {
    const source = Array.isArray(raw) ? {
      id: raw[0],
      title: raw[1],
      href: raw[2],
      task: raw[3],
      success: raw[4],
      value: raw[5]
    } : (raw || {});
    const localId = text(source.id, slug(source.href || source.title || ("lab-" + index)));
    return {
      id: moduleId + ".lab." + localId,
      localId,
      title: text(source.title, "未命名實驗"),
      href: text(source.href || source.path),
      task: text(source.task || source.objective),
      success: text(source.success || source.acceptance),
      value: text(source.value || source.whyUseful),
      competency: text(source.competency, moduleId + ".lab." + localId),
      transferPrompt: text(source.transferPrompt, "換一組參數後，原本結論是否仍成立？為什麼？")
    };
  }

  function normalizeFault(moduleId, raw, index) {
    const source = Array.isArray(raw) ? {
      symptom: raw[0],
      cause: raw[1],
      verify: raw[2],
      fix: raw[3],
      href: raw[4]
    } : (raw || {});
    const localId = text(source.id, slug(source.symptom || source.href || ("fault-" + index)));
    return {
      id: moduleId + ".fault." + localId,
      localId,
      symptom: text(source.symptom, "未命名症狀"),
      cause: text(source.cause),
      verify: text(source.verify),
      fix: text(source.fix),
      href: text(source.href),
      competency: text(source.competency, moduleId + ".diagnosis." + localId)
    };
  }

  function normalizeModule(raw, index) {
    const source = raw || {};
    const moduleId = text(source.id, "module-" + index);
    const entry = text(source.entry);
    const base = directoryOf(entry);
    const lessons = (source.lessons || []).map((item, itemIndex) => normalizeLesson(moduleId, base, item, itemIndex));
    const labs = (source.labs || []).map((item, itemIndex) => normalizeLab(moduleId, item, itemIndex));
    const faults = (source.faults || []).map((item, itemIndex) => normalizeFault(moduleId, item, itemIndex));
    const competencies = Array.from(new Set([
      ...lessons.map(item => item.competency),
      ...labs.map(item => item.competency),
      ...faults.map(item => item.competency)
    ].filter(Boolean)));

    return {
      id: moduleId,
      number: text(source.number, String(index)),
      tag: text(source.tag, moduleId.toUpperCase()),
      title: text(source.title, moduleId),
      entry,
      oneLine: text(source.oneLine),
      analogy: text(source.analogy),
      whyUseful: text(source.whyUseful),
      lessons,
      labs,
      faults,
      competencies,
      modelIds: Array.isArray(source.modelIds) ? source.modelIds.slice() : []
    };
  }

  function normalizeCurriculum(rawCurriculum) {
    const rawModules = rawCurriculum && Array.isArray(rawCurriculum.modules) ? rawCurriculum.modules : [];
    const modules = rawModules.map(normalizeModule);
    return {
      schemaVersion: SCHEMA_VERSION,
      modules,
      moduleById: Object.fromEntries(modules.map(module => [module.id, module]))
    };
  }

  function completionIds(curriculum) {
    return curriculum.modules.flatMap(module => [
      ...module.lessons.map(item => item.id),
      ...module.labs.map(item => item.id)
    ]);
  }

  function migrateLegacyDone(rawCurriculum, legacyDone) {
    const normalized = normalizeCurriculum(rawCurriculum);
    const migrated = {};
    const source = legacyDone && typeof legacyDone === "object" ? legacyDone : {};
    normalized.modules.forEach(module => {
      module.lessons.forEach((lesson, index) => {
        if (source[module.id + ":lesson:" + index]) migrated[lesson.id] = true;
      });
      module.labs.forEach(lab => {
        if (source[module.id + ":lab:" + lab.localId]) migrated[lab.id] = true;
      });
    });
    return migrated;
  }

  function validate(curriculum) {
    const errors = [];
    const seen = new Set();
    curriculum.modules.forEach(module => {
      [module, ...module.lessons, ...module.labs, ...module.faults].forEach(item => {
        if (!item.id) errors.push("missing id");
        else if (seen.has(item.id)) errors.push("duplicate id: " + item.id);
        else seen.add(item.id);
      });
      module.lessons.forEach(lesson => {
        if (!lesson.href) errors.push("lesson missing href: " + lesson.id);
        if (!lesson.competency) errors.push("lesson missing competency: " + lesson.id);
      });
      module.labs.forEach(lab => {
        if (!lab.href) errors.push("lab missing href: " + lab.id);
      });
    });
    return errors;
  }

  return {
    SCHEMA_VERSION,
    slug,
    normalizeCurriculum,
    completionIds,
    migrateLegacyDone,
    validate
  };
});
