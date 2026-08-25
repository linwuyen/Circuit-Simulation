(() => {
  "use strict";

  const Flow = window.CircuitCoreFlowV1;
  if (!Flow) return;

  const layerByKey = new Map(Flow.layers.map(layer => [layer.key, layer]));

  function syncFooter(footer) {
    const key = footer?.dataset.coreFooter;
    if (!key || !layerByKey.has(key)) return;

    const state = Flow.snapshot();
    const layer = layerByKey.get(key);
    const index = Flow.layerKeys.indexOf(key);
    const completed = Boolean(state.completed[key]);
    const predicted = Boolean(state.predictions[key]);
    const interacted = Boolean(state.interactions[key]);
    const mastered = Boolean(Flow.mastered(key));
    const needsRemediation = Boolean(Flow.needsRemediation(key));
    const ready = Boolean(Flow.ready(key));

    const completeButton = footer.querySelector('[data-core-complete]');
    const status = footer.querySelector('[data-core-footer-status]');
    if (!completeButton || !status) return;

    completeButton.disabled = !ready && !completed;

    if (completed) {
      completeButton.textContent = index === Flow.layerKeys.length - 1
        ? '八層主線完成 ✓'
        : `已完成 · 前往 ${layerByKey.get(Flow.layerKeys[index + 1])?.number || ''} ${layerByKey.get(Flow.layerKeys[index + 1])?.label || ''} →`;
      status.textContent = '本層已持久化；重新整理不會遺失。';
      return;
    }

    if (needsRemediation) {
      completeButton.textContent = '先完成修正題';
      status.textContent = interacted
        ? '第一次預測答錯；單變因操作已完成，但必須先通過不同情境的修正題，才能完成本層。'
        : '第一次預測答錯；先通過不同情境的修正題，並完成一個單變因操作。';
      return;
    }

    if (ready) {
      completeButton.textContent = '完成本層並繼續 →';
      status.textContent = '概念理解與單變因操作都已完成，可以完成本層。';
      return;
    }

    if (mastered && !interacted) {
      completeButton.textContent = '先操作一個變因';
      status.textContent = '概念已通過；請操作一個變因並觀察可量測結果。';
      return;
    }

    completeButton.textContent = predicted ? '先完成修正題' : '先完成上方預測';
    status.textContent = predicted
      ? '第一次預測尚未形成可完成的 mastery；請先完成修正理解。'
      : '先預測方向，再操作與觀察。';
  }

  function syncAll() {
    document.querySelectorAll('[data-core-footer]').forEach(syncFooter);
  }

  function deferSync() {
    window.requestAnimationFrame(syncAll);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-core-complete]');
    if (!button) return;
    const footer = button.closest('[data-core-footer]');
    const key = footer?.dataset.coreFooter;
    if (!key || !layerByKey.has(key)) return;

    const state = Flow.snapshot();
    if (!state.completed[key] && !Flow.ready(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      syncFooter(footer);
    }
  }, true);

  window.addEventListener('circuit:core-flow-change', deferSync);

  const observer = new MutationObserver(deferSync);
  observer.observe(document.body, { childList: true, subtree: true });

  deferSync();
})();
