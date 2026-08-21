(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitBoardEvidenceV1 = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const REQUIRED_BINDINGS = Object.freeze([
    "pwmPinmuxAndPolarity",
    "adcChannels",
    "adcAcquisitionWindow",
    "voltageScaling",
    "currentScaling",
    "cmpssInputAndThreshold",
    "deadTimeAndComplementaryOutputs",
    "startupAndRearmPolicy",
    "communicationOwner"
  ]);
  const REQUIRED_EVIDENCE = Object.freeze(["pwm", "gpio", "soc", "trip", "soft", "load", "timeout", "rearm"]);

  const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

  function validateManifest(manifest) {
    const value = manifest && typeof manifest === "object" ? manifest : {};
    const bindings = value.bindings && typeof value.bindings === "object" ? value.bindings : {};
    const evidence = Array.isArray(value.evidence) ? value.evidence : [];
    const evidenceById = new Map(evidence.map(item => [item && item.id, item]));

    const bindingRows = REQUIRED_BINDINGS.map(id => {
      const item = bindings[id] || {};
      const verified = item.status === "VERIFIED" && nonEmpty(item.source);
      return Object.freeze({ id, status: item.status || "MISSING", source: item.source || null, verified });
    });
    const evidenceRows = REQUIRED_EVIDENCE.map(id => {
      const item = evidenceById.get(id) || {};
      const passed = item.status === "PASS" && nonEmpty(item.artifact);
      return Object.freeze({ id, status: item.status || "MISSING", artifact: item.artifact || null, passed, criterion: item.criterion || "" });
    });

    const bindingsVerified = bindingRows.every(row => row.verified);
    const evidencePassed = evidenceRows.every(row => row.passed);
    const targetBuildPassed = value.targetBuild && value.targetBuild.status === "PASS" && nonEmpty(value.targetBuild.artifact);
    const computedClaim = bindingsVerified && evidencePassed && targetBuildPassed ? "BOARD_PASS" : "UNCLAIMED";
    const requestedClaim = value.boardClaim || "UNCLAIMED";
    const claimValid = requestedClaim !== "BOARD_PASS" || computedClaim === "BOARD_PASS";

    return Object.freeze({
      schemaVersion: Number(value.schemaVersion || 0),
      target: value.target || "",
      requestedClaim,
      computedClaim,
      claimValid,
      bindingsVerified,
      evidencePassed,
      targetBuildPassed,
      bindingRows: Object.freeze(bindingRows),
      evidenceRows: Object.freeze(evidenceRows),
      missingBindings: Object.freeze(bindingRows.filter(row => !row.verified).map(row => row.id)),
      missingEvidence: Object.freeze(evidenceRows.filter(row => !row.passed).map(row => row.id))
    });
  }

  function assertBoardPass(manifest) {
    const result = validateManifest(manifest);
    if (result.requestedClaim === "BOARD_PASS" && !result.claimValid) {
      throw new Error(`BOARD_PASS rejected: missing bindings=${result.missingBindings.join(",") || "none"}; missing evidence=${result.missingEvidence.join(",") || "none"}; targetBuild=${result.targetBuildPassed ? "PASS" : "MISSING"}`);
    }
    return result;
  }

  return Object.freeze({ REQUIRED_BINDINGS, REQUIRED_EVIDENCE, validateManifest, assertBoardPass });
});
