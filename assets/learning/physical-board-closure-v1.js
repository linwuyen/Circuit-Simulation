(function (root, factory) {
  const api = factory(root);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CircuitPhysicalBoardClosureV1 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  const Board = root.CircuitBoardEvidenceV1 || (typeof require === "function" ? require("./board-evidence-v1.js") : null);
  if (!Board) throw new Error("CircuitBoardEvidenceV1 is required");

  const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
  const iso = value => nonEmpty(value) && Number.isFinite(Date.parse(value));
  const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};

  function sourceValid(source) {
    const value = object(source);
    return nonEmpty(value.kind) && nonEmpty(value.ref) && iso(value.verifiedAt);
  }

  function artifactValid(artifact) {
    const value = object(artifact);
    return nonEmpty(value.ref) && nonEmpty(value.sha256) && /^[a-f0-9]{64}$/i.test(value.sha256) && nonEmpty(value.instrument) && iso(value.capturedAt);
  }

  function flashValid(flash) {
    const value = object(flash);
    return value.status === "PASS" && nonEmpty(value.imageArtifact) && nonEmpty(value.ccxmlArtifact) && nonEmpty(value.probe) && iso(value.flashedAt) && value.resetBootObserved === true;
  }

  function toBoardManifest(pkg) {
    const value = object(pkg);
    const bindings = {};
    for (const id of Board.REQUIRED_BINDINGS) {
      const item = object(object(value.bindings)[id]);
      bindings[id] = {
        status: item.status === "VERIFIED" && sourceValid(item.source) ? "VERIFIED" : "UNBOUND",
        source: sourceValid(item.source) ? `${item.source.kind}:${item.source.ref}` : null
      };
    }
    const evidenceById = new Map((Array.isArray(value.evidence) ? value.evidence : []).map(item => [item && item.id, item]));
    const evidence = Board.REQUIRED_EVIDENCE.map(id => {
      const item = object(evidenceById.get(id));
      const pass = item.status === "PASS" && artifactValid(item.artifact) && nonEmpty(item.acceptance) && item.accepted === true;
      return {
        id,
        status: pass ? "PASS" : "MISSING",
        artifact: pass ? item.artifact.ref : null,
        criterion: item.acceptance || ""
      };
    });
    return {
      schemaVersion: 2,
      target: nonEmpty(value.boardIdentity && value.boardIdentity.target) ? value.boardIdentity.target : "",
      boardClaim: value.requestedClaim === "BOARD_PASS" ? "BOARD_PASS" : "UNCLAIMED",
      truthLevel: "PHYSICAL_BOARD_EVIDENCE",
      targetBuild: {
        status: flashValid(value.flash) ? "PASS" : "MISSING",
        artifact: flashValid(value.flash) ? value.flash.imageArtifact : null
      },
      bindings,
      evidence
    };
  }

  function validatePackage(pkg) {
    const value = object(pkg);
    const identity = object(value.boardIdentity);
    const identityValid = nonEmpty(identity.target) && nonEmpty(identity.revision) && nonEmpty(identity.mcu);
    const flashPassed = flashValid(value.flash);

    const bindingRows = Board.REQUIRED_BINDINGS.map(id => {
      const item = object(object(value.bindings)[id]);
      const valid = item.status === "VERIFIED" && sourceValid(item.source);
      return Object.freeze({ id, valid, status: item.status || "MISSING", source: item.source || null });
    });

    const evidenceById = new Map((Array.isArray(value.evidence) ? value.evidence : []).map(item => [item && item.id, item]));
    const evidenceRows = Board.REQUIRED_EVIDENCE.map(id => {
      const item = object(evidenceById.get(id));
      const valid = item.status === "PASS" && item.accepted === true && nonEmpty(item.acceptance) && artifactValid(item.artifact);
      return Object.freeze({ id, valid, status: item.status || "MISSING", accepted: item.accepted === true, artifact: item.artifact || null });
    });

    const bindingsVerified = bindingRows.every(row => row.valid);
    const evidencePassed = evidenceRows.every(row => row.valid);
    const boardResult = Board.validateManifest(toBoardManifest(value));
    const computedClaim = identityValid && flashPassed && bindingsVerified && evidencePassed && boardResult.computedClaim === "BOARD_PASS" ? "BOARD_PASS" : "UNCLAIMED";
    const requestedClaim = value.requestedClaim || "UNCLAIMED";
    const claimValid = requestedClaim !== "BOARD_PASS" || computedClaim === "BOARD_PASS";

    const actions = [];
    if (!identityValid) actions.push("complete board identity: target/revision/mcu");
    if (!flashPassed) actions.push("record a real PASS flash session with image, CCXML, probe, timestamp and reset/boot observation");
    for (const row of bindingRows.filter(row => !row.valid)) actions.push(`verify binding ${row.id} with typed source + verifiedAt`);
    for (const row of evidenceRows.filter(row => !row.valid)) actions.push(`capture and accept physical evidence ${row.id} with artifact sha256/instrument/capturedAt`);

    return Object.freeze({
      schemaVersion: Number(value.schemaVersion || 0),
      requestedClaim,
      computedClaim,
      claimValid,
      identityValid,
      flashPassed,
      bindingsVerified,
      evidencePassed,
      bindingRows: Object.freeze(bindingRows),
      evidenceRows: Object.freeze(evidenceRows),
      remainingActions: Object.freeze(actions),
      boardManifest: Object.freeze(toBoardManifest(value))
    });
  }

  function assertPackage(pkg) {
    const result = validatePackage(pkg);
    if (result.requestedClaim === "BOARD_PASS" && !result.claimValid) {
      throw new Error(`BOARD_PASS rejected: ${result.remainingActions.join("; ") || "closure package invalid"}`);
    }
    return result;
  }

  return Object.freeze({ validatePackage, assertPackage, toBoardManifest, sourceValid, artifactValid, flashValid });
});
