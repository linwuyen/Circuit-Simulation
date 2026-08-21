(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Session = global.CircuitOutcomeSessionV1;
  if (!Learning || !Learning.renderHome || !Session) return;
  const previous = Learning.renderHome;
  const pct = value => value == null ? "—" : `${Math.round(value * 100)}%`;
  const due = value => value ? new Date(value).toLocaleDateString('zh-TW') : '—';

  function enhance(rootId) {
    const root = document.getElementById(rootId);
    const main = root && root.querySelector('main');
    const hero = main && main.querySelector('.hero');
    if (!main || !hero || main.querySelector('[data-outcome-home]')) return;
    const summary = Session.summary();
    const comparison = summary.comparison;
    const section = document.createElement('section');
    section.className = 'metric-grid';
    section.dataset.outcomeHome = '1';
    section.innerHTML = `
      <div class="metric"><span class="tag blue">CAPSTONE PRE</span><h3>${pct(summary.pre.score && summary.pre.score.accuracy)}</h3><p>${summary.pre.attempted}/${summary.pre.total} first attempts</p></div>
      <div class="metric"><span class="tag green">CAPSTONE POST</span><h3>${pct(summary.post.score && summary.post.score.accuracy)}</h3><p>${summary.post.attempted}/${summary.post.total} first attempts</p></div>
      <div class="metric"><span class="tag amber">UNSEEN Δ</span><h3>${comparison && comparison.delta != null ? `${comparison.delta >= 0 ? '+' : ''}${Math.round(comparison.delta * 100)} pp` : '—'}</h3><p>learner change, not causal claim</p></div>
      <div class="metric"><span class="tag">NEXT MEASUREMENT</span><h3>${pct(summary.post.score && summary.post.score.nextMeasurementAccuracy)}</h3><p>post unseen</p></div>
      <div class="metric"><span class="tag">TRANSFER</span><h3>${pct(summary.post.score && summary.post.score.transferAccuracy)}</h3><p>post unseen</p></div>
      <div class="metric"><span class="tag rose">RETENTION</span><h3>${summary.nextDue ? summary.nextDue.phase.toUpperCase() : '—'}</h3><p>${summary.nextDue ? `due ${due(summary.nextDue.dueAt)}` : 'POST 後建立 1/7/30/90d'}</p></div>`;
    hero.insertAdjacentElement('afterend', section);
  }

  Learning.renderHome = function renderHomeWithOutcome(rootId) {
    previous(rootId);
    enhance(rootId);
  };
  global.CircuitOutcomeHomeV1 = { enhance };
})(window);
