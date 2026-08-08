(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitCompetencyBindings = api;
  if (root.CircuitAssessment && typeof root.CircuitAssessment.coverageSummary === "function") api.install(root.CircuitAssessment);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // These bindings are semantic relationships, not display-name aliases. They bridge
  // legacy curriculum-generated competencies to the stable assessment competency IDs.
  const bindings = {
    "buck.current-ripple.relationship": {
      moduleId: "buck",
      lessonCompetencies: ["buck.電流漣波"],
      labIds: ["buck.lab.buck-ripple"]
    },
    "buck.ccm-dcm.boundary": {
      moduleId: "buck",
      lessonCompetencies: ["buck.ccm-dcm"],
      labIds: ["buck.lab.buck-dcm"]
    },
    "buck.model.validity": {
      moduleId: "buck",
      lessonCompetencies: ["buck.ccm-dcm"],
      labIds: ["buck.lab.buck-dcm"]
    },
    "adc.quantization.levels": {
      moduleId: "adc",
      lessonCompetencies: ["adc.adc-基礎"],
      labIds: ["adc.lab.adc-code"]
    },
    "adc.divider.power": {
      moduleId: "adc",
      lessonCompetencies: ["adc.高壓分壓"],
      labIds: ["adc.lab.adc-divider"]
    },
    "adc.current.offset": {
      moduleId: "adc",
      lessonCompetencies: ["adc.為什麼要-offset"],
      labIds: ["adc.lab.adc-offset"]
    },
    "spi.throughput.clock": {
      moduleId: "spi",
      lessonCompetencies: ["spi.spi-是什麼", "spi.四條線"],
      labIds: ["spi.lab.spi-fifo"]
    },
    "spi.rx.overrun": {
      moduleId: "spi",
      lessonCompetencies: ["spi.為什麼需要-fifo"],
      labIds: ["spi.lab.spi-fifo"]
    },
    "spi.mode.cpol-cpha": {
      moduleId: "spi",
      lessonCompetencies: ["spi.cpol-cpha"],
      labIds: ["spi.lab.spi-mode"]
    }
  };

  function statusFor(row) {
    if (row.oracle && row.transfer && row.retention) return "verified";
    if (row.transfer && row.retention) return "measured";
    if (row.lab) return "practiced";
    if (row.lesson) return "taught";
    return "unmeasured";
  }

  function canonicalizeCoverage(summary, curriculum, oracleLabIds) {
    const source = summary || { rows: [], moduleRows: [] };
    const rows = (source.rows || []).map(row => ({ ...row }));
    const byCompetency = new Map(rows.map(row => [row.competency, row]));
    const modules = (curriculum && curriculum.modules) || [];
    const oracleSet = new Set(oracleLabIds || ["buck.lab.buck-ripple", "adc.lab.adc-divider"]);
    const consumedAliases = new Set();

    Object.entries(bindings).forEach(([canonical, binding]) => {
      const module = modules.find(item => item.id === binding.moduleId);
      const current = byCompetency.get(canonical) || {
        competency: canonical,
        moduleId: binding.moduleId,
        lesson: false,
        lab: false,
        oracle: false,
        transfer: false,
        retention: false
      };

      const lessonMatches = (module && module.lessons || []).filter(lesson =>
        (binding.lessonCompetencies || []).includes(lesson.competency)
      );
      const labMatches = (module && module.labs || []).filter(lab =>
        (binding.labIds || []).includes(lab.id)
      );

      current.moduleId = binding.moduleId;
      current.lesson = current.lesson || lessonMatches.length > 0;
      current.lab = current.lab || labMatches.length > 0;
      current.oracle = current.oracle || labMatches.some(lab => oracleSet.has(lab.id));
      current.status = statusFor(current);
      byCompetency.set(canonical, current);

      (binding.lessonCompetencies || []).forEach(alias => {
        if (alias !== canonical) consumedAliases.add(alias);
      });
      labMatches.forEach(lab => {
        if (lab.competency && lab.competency !== canonical) consumedAliases.add(lab.competency);
      });
    });

    const canonicalRows = [...byCompetency.values()]
      .filter(row => !consumedAliases.has(row.competency))
      .map(row => ({ ...row, status: statusFor(row) }));

    const moduleRows = modules.map(module => {
      const items = canonicalRows.filter(row => row.moduleId === module.id);
      const measured = items.filter(row => row.transfer && row.retention).length;
      const verified = items.filter(row => row.oracle && row.transfer && row.retention).length;
      return {
        moduleId: module.id,
        title: module.title,
        total: items.length,
        measured,
        verified,
        coveragePct: items.length ? Math.round(measured / items.length * 100) : 0
      };
    });

    return {
      ...source,
      total: canonicalRows.length,
      measured: canonicalRows.filter(row => row.transfer && row.retention).length,
      verified: canonicalRows.filter(row => row.oracle && row.transfer && row.retention).length,
      rows: canonicalRows,
      moduleRows
    };
  }

  function install(assessment) {
    if (!assessment || typeof assessment.coverageSummary !== "function") throw new Error("assessment coverageSummary missing");
    if (assessment.__canonicalCoverageBindingsInstalled) return assessment;
    const baseCoverageSummary = assessment.coverageSummary.bind(assessment);
    assessment.coverageSummary = function (curriculum, questions, oracleLabIds) {
      return canonicalizeCoverage(baseCoverageSummary(curriculum, questions, oracleLabIds), curriculum, oracleLabIds);
    };
    Object.defineProperty(assessment, "__canonicalCoverageBindingsInstalled", { value: true, enumerable: false });
    return assessment;
  }

  return { bindings, canonicalizeCoverage, install };
});