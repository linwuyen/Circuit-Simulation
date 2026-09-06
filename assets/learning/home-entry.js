// Deferred scripts execute in document order. This is the only homepage mount.
(function (global) {
  "use strict";
  const required = ["CircuitLearning", "CircuitCoreFlowV1", "CircuitJourneyV1", "CircuitEvidence"];
  const missing = required.filter(name => !global[name]);
  const app = global.document.getElementById("app");
  if (missing.length) {
    app.textContent = "教材載入未完成，請重新整理頁面。";
    app.setAttribute("role", "alert");
    console.error("Missing homepage dependencies:", missing.join(", "));
    return;
  }
  global.CircuitJourneyV1.render("app");
})(window);
