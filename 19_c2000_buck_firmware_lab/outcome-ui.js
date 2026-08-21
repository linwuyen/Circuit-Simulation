(() => {
  "use strict";
  const Session = window.CircuitOutcomeSessionV1;
  const Benchmark = window.CircuitOutcomeBenchmarkV1;
  if (!Session || !Benchmark) return;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  let activePhase = "pre";

  function pct(value) { return value == null ? "—" : `${Math.round(value * 100)}%`; }
  function fmtDate(value) { return value ? new Date(value).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'; }

  function renderDashboard() {
    const summary = Session.summary();
    const comparison = summary.comparison;
    $('#outcomeDashboard').innerHTML = `
      <div><span>PRE</span><b>${pct(summary.pre.score && summary.pre.score.accuracy)}</b><small>${summary.pre.attempted}/${summary.pre.total} first attempts</small></div>
      <div><span>POST</span><b>${pct(summary.post.score && summary.post.score.accuracy)}</b><small>${summary.post.attempted}/${summary.post.total} first attempts</small></div>
      <div><span>Δ UNSEEN</span><b>${comparison && comparison.delta != null ? `${comparison.delta >= 0 ? '+' : ''}${Math.round(comparison.delta*100)} pp` : '—'}</b><small>not a causal claim</small></div>
      <div><span>NEXT MEASURE</span><b>${pct(summary.post.score && summary.post.score.nextMeasurementAccuracy)}</b><small>post unseen</small></div>
      <div><span>TRANSFER</span><b>${pct(summary.post.score && summary.post.score.transferAccuracy)}</b><small>post unseen</small></div>
      <div><span>NEXT RETENTION</span><b>${summary.nextDue ? summary.nextDue.phase.toUpperCase() : 'DONE'}</b><small>${summary.nextDue ? fmtDate(summary.nextDue.dueAt) : 'all checkpoints complete'}</small></div>`;

    $$('.outcome-phase-button').forEach(button => {
      const status = Session.phaseStatus(button.dataset.phase);
      button.classList.toggle('selected', button.dataset.phase === activePhase);
      button.dataset.complete = status.completed ? '1' : '0';
      const dueText = status.dueAt ? (status.due ? 'DUE' : fmtDate(status.dueAt)) : '';
      button.querySelector('small').textContent = status.completed ? 'COMPLETE' : `${status.attempted}/${status.total}${dueText ? ` · ${dueText}` : ''}`;
    });
  }

  function phaseAllowed(phase) {
    const summary = Session.summary();
    if (phase === 'post' && !summary.pre.completed) return { ok:false, reason:'先完成 PRE unseen set；否則 pre/post 不再是有效配對。' };
    if (/^r[1-4]$/.test(phase)) {
      if (!summary.post.completed) return { ok:false, reason:'Retention 必須在 POST 完成後才建立 due date。' };
      const status = Session.phaseStatus(phase);
      if (!status.due && !status.completed) return { ok:false, reason:`${phase.toUpperCase()} 尚未到期：${fmtDate(status.dueAt)}` };
    }
    return { ok:true };
  }

  function currentItem() {
    const status = Session.phaseStatus(activePhase);
    const record = Session.loadRecord();
    const first = record.sessions?.[activePhase]?.firstAttempts || {};
    return status.cases.find(item => !first[item.id]) || null;
  }

  function renderQuestion() {
    const allowed = phaseAllowed(activePhase);
    if (!allowed.ok) {
      $('#outcomeQuestion').innerHTML = `<p class="truth-box">${allowed.reason}</p>`;
      renderDashboard();
      return;
    }
    Session.startPhase(activePhase);
    const item = currentItem();
    const status = Session.phaseStatus(activePhase);
    if (!item) {
      $('#outcomeQuestion').innerHTML = `<div class="truth-box"><b>${activePhase.toUpperCase()} COMPLETE</b><br>First-attempt accuracy ${pct(status.score && status.score.accuracy)}。Retry 不會覆寫 first attempt。</div>`;
      renderDashboard();
      return;
    }
    const index = status.cases.findIndex(testCase => testCase.id === item.id) + 1;
    const choiceMarkup = item.answerType === 'timing'
      ? `<div class="prediction-row"><button type="button" data-outcome-judgement="met">第一個 ZERO 趕得上</button><button type="button" data-outcome-judgement="missed">錯過第一個 ZERO</button></div><label class="control-label">Physical commit (µs)<input id="outcomeCommitUs" type="number" step="0.001" placeholder="例如 10.000"></label><button class="button primary" type="button" id="outcomeTimingSubmit" disabled>鎖定 first attempt</button>`
      : `<div class="prediction-row">${item.choices.map(choice => `<button type="button" data-outcome-choice="${choice}">${choice}</button>`).join('')}</div>`;
    $('#outcomeQuestion').innerHTML = `<div class="section-kicker">${activePhase.toUpperCase()} · ${item.competency} · ${index}/${status.total}</div><h3>${item.prompt}</h3><p class="muted">送出後 first attempt 永久鎖定；重答只記 retry。</p>${choiceMarkup}<p class="prediction-status" id="outcomeAnswerStatus" aria-live="polite"></p>`;

    if (item.answerType === 'timing') {
      let judgement = null;
      $$('[data-outcome-judgement]').forEach(button => button.addEventListener('click', () => {
        judgement = button.dataset.outcomeJudgement;
        $$('[data-outcome-judgement]').forEach(other => other.classList.toggle('selected', other === button));
        $('#outcomeTimingSubmit').disabled = !judgement || !Number.isFinite(Number($('#outcomeCommitUs').value));
      }));
      $('#outcomeCommitUs').addEventListener('input', () => { $('#outcomeTimingSubmit').disabled = !judgement || !Number.isFinite(Number($('#outcomeCommitUs').value)); });
      $('#outcomeTimingSubmit').addEventListener('click', () => submit(item, { judgement, commitUs:Number($('#outcomeCommitUs').value) }));
    } else {
      $$('[data-outcome-choice]').forEach(button => button.addEventListener('click', () => submit(item, button.dataset.outcomeChoice)));
    }
    renderDashboard();
  }

  function submit(item, answer) {
    const result = Session.recordAttempt(activePhase, item.id, answer);
    const status = $('#outcomeAnswerStatus');
    status.dataset.result = result.correct ? 'pass' : 'fail';
    status.textContent = result.correct ? '✓ First attempt correct。' : '✗ First attempt 已鎖定；保留錯誤作為學習證據。';
    window.setTimeout(renderQuestion, 450);
  }

  $$('.outcome-phase-button').forEach(button => button.addEventListener('click', () => {
    activePhase = button.dataset.phase;
    renderQuestion();
  }));

  $('#outcomeReset')?.addEventListener('click', () => {
    if (window.confirm('清除本機 PRE/POST/retention benchmark evidence？此操作只影響瀏覽器 local state。')) {
      Session.reset(); activePhase = 'pre'; renderQuestion();
    }
  });

  renderQuestion();
})();