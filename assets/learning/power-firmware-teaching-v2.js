(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Store = global.CircuitPowerSystemStateV1;
  const I = global.CircuitPowerTeachingV2Internal;
  if (!Learning || typeof Learning.renderHome !== "function" || !Store || !I || !I.insertEnhancements || !I.bind || !I.render) return;
  const previousRenderHome = Learning.renderHome;
  function mount(root) {
    if (!root || root.dataset.powerTeachingV2 === "mounted") return;
    I.insertEnhancements(root);
    I.bind(root);
    I.render(root);
    const unsubscribe = Store.subscribe(() => I.render(root));
    root.dataset.powerTeachingV2 = "mounted";
    global.CircuitPowerTeachingV2 = { render: () => I.render(root), destroy: unsubscribe };
  }
  Learning.renderHome = function renderHomeWithTeachingV2(rootId) {
    previousRenderHome(rootId);
    mount(document.getElementById(rootId));
  };
})(window);
