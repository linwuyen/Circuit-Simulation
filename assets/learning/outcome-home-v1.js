(function (global) {
  "use strict";
  const Learning = global.CircuitLearning;
  const Session = global.CircuitOutcomeSessionV1;
  const Benchmark = global.CircuitOutcomeBenchmarkV1;
  if (!Learning || !Learning.renderHome || !Session) return;
  const previous = Learning.renderHome;
  const pct = value => value == null ? "—" : `${Math.round(value * 100)}%`;
  const due = value => value ? new Date(value).toLocaleDateString('zh-TW') : '—';

  function profileMetrics(summary) {
    const score = summary.post.score || null;
    if (summary.profile !== 'core8' || !Benchmark?.PROFILES?.core8) {
      return `
        <div class="metric"><span class="tag">NEXT MEASUREMENT</span><h3>${pct(score && score.nextMeasurementAccuracy)}</h3><p>post unseen</p></div>
        <div class="metric"><span class="tag">TRANSFER</span><h3>${pct(score && score.transferAccuracy)}</h3><p>post unseen</p></div>`;
    }
    const expected = Benchmark.PROFILES.core8.competencies;
    const byCompetency = score && score.byCompetency || {};
    const attempted = score ? score.attemptedCompetencies : 0;
    const missed = expected.filter(key => {
      const row = byCompetency[key];
      return row && row.attempted > 0 && row.correct < row.attempted;
    });
    return `
      <div class="metric"><span class="tag">CORE LAYERS</span><h3>${attempted}/${expected.length}</h3><p>post unseen coverage</p></div>
      <div class="metric"><span class="tag">MISSED LAYERS</span><h3>${missed.length || '—'}</h3><p>${missed.length ? missed.join(' · ') : 'complete POST to locate gaps'}</p></div>`;
  }

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
    section.dataset.profile = summary.profile || 'legacy4';
    section.innerHTML = `
      <div class="metric"><span class="tag blue">CAPSTONE PRE · ${(summary.profile || 'legacy4').toUpperCase()}</span><h3>${pct(summary.pre.score && summary.pre.score.accuracy)}</h3><p>${summary.pre.attempted}/${summary.pre.total} first attempts</p></div>
      <div class="metric"><span class="tag green">CAPSTONE POST</span><h3>${pct(summary.post.score && summary.post.score.accuracy)}</h3><p>${summary.post.attempted}/${summary.post.total} first attempts</p></div>
      <div class="metric"><span class="tag amber">UNSEEN Δ</span><h3>${comparison && comparison.delta != null ? `${comparison.delta >= 0 ? '+' : ''}${Math.round(comparison.delta * 100)} pp` : '—'}</h3><p>learner change, not causal claim</p></div>
      ${profileMetrics(summary)}
      <div class="metric"><span class="tag rose">RETENTION</span><h3>${summary.nextDue ? summary.nextDue.phase.toUpperCase() : '—'}</h3><p>${summary.nextDue ? `due ${due(summary.nextDue.dueAt)}` : 'POST 後建立 1/7/30/90d'}</p></div>`;

    // First-principles learning stays above measurement dashboards.  When the
    // Journey layer is present, outcome metrics belong in its collapsed
    // evidence drawer rather than between the hero and the causal learning path.
    const evidenceDrawer = main.querySelector('.journey-advanced-evidence');
    if (evidenceDrawer) evidenceDrawer.appendChild(section);
    else {
      const journey = main.querySelector('.journey-shell');
      if (journey) journey.insertAdjacentElement('afterend', section);
      else hero.insertAdjacentElement('afterend', section);
    }
  }

  Learning.renderHome = function renderHomeWithOutcome(rootId) {
    previous(rootId);
    enhance(rootId);
  };
  global.CircuitOutcomeHomeV1 = { enhance };
})(window);
