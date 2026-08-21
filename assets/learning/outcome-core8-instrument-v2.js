(function (root, factory) {
  const Benchmark = root && root.CircuitOutcomeBenchmarkV1 || (typeof require === "function" ? require("./outcome-benchmark-v1.js") : null);
  const Families = root && root.CircuitOutcomeFamiliesV2 || (typeof require === "function" ? require("./outcome-families-v2.js") : null);
  const api = factory(Benchmark, Families);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitOutcomeCore8InstrumentV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Benchmark, Families) {
  "use strict";
  if (!Benchmark || !Families) throw new Error("Benchmark and FamiliesV2 are required");

  const VERSION = 2;
  const PROFILE = "core8";
  const PHASES = Object.freeze(["pre","post","r1","r2","r3","r4"]);
  const BANK_PHASES = new Set(["pre","post","r1","r2"]);

  function bridgeFamily(item, phase) {
    const family = Families.FAMILY_CATALOG[item.competency] && Families.FAMILY_CATALOG[item.competency][0];
    if (!family) throw new Error(`missing v2 family bridge for ${item.competency}`);
    return Object.freeze({
      ...item,
      familyId:family.id,
      familyContract:family.contract,
      variantId:`${family.id}:${phase}:bridge-v${item.parameters && item.parameters.variantSlot}`,
      instrumentVersion:VERSION
    });
  }

  function generateBenchmarkSet({ seed = 20260821, phase = "pre", countPerCompetency = 1 } = {}) {
    if (!PHASES.includes(phase)) throw new RangeError(`unknown benchmark phase: ${phase}`);
    if (countPerCompetency !== 1) throw new RangeError("core8 instrument v2 keeps exactly one item per competency per phase");
    const cases = BANK_PHASES.has(phase)
      ? Families.generateBenchmarkSet({ seed, phase, countPerCompetency })
      : Benchmark.generateBenchmarkSet({ seed, phase, countPerCompetency, profile:"core8" }).map(item => bridgeFamily(item, phase));
    const fingerprints = cases.map(Benchmark.contentFingerprint);
    if (new Set(fingerprints).size !== fingerprints.length) throw new Error(`${phase}/core8/v2 contains duplicate content inside phase`);
    return Object.freeze(cases);
  }

  function assertAllPhasesDisjoint({ seed = 20260821 } = {}) {
    const owner = new Map();
    for (const phase of PHASES) {
      for (const item of generateBenchmarkSet({ seed, phase })) {
        const fingerprint = Benchmark.contentFingerprint(item);
        if (owner.has(fingerprint)) throw new Error(`core8 v2 reuses content between ${owner.get(fingerprint)} and ${phase}`);
        owner.set(fingerprint, phase);
      }
    }
    return true;
  }

  function familyContractFingerprint() {
    return Families.contractFingerprint();
  }

  return Object.freeze({
    VERSION,
    PROFILE,
    PHASES,
    COMPETENCIES:Families.COMPETENCIES,
    FAMILY_CATALOG:Families.FAMILY_CATALOG,
    familyContractFingerprint,
    generateBenchmarkSet,
    assertAllPhasesDisjoint
  });
});
