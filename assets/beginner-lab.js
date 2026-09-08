(() => {
  'use strict';
  const { lessons, accepts, updateAt, complete } = CircuitBeginnerLessons;
  const E = CircuitEvidence, $ = id => document.getElementById(id);
  const stored = E.load().benchmark.beginnerLessons;
  const progress = stored && stored.version === 1 && stored.rows && typeof stored.rows === 'object' ? stored : { version:1, rows:{} };
  let index = 0, value, phase = .1, model, timer = null;
  const lesson = () => lessons[index];
  const record = () => {
    const id = lesson().id;
    if (!progress.rows[id] || typeof progress.rows[id] !== 'object') progress.rows[id] = {};
    return progress.rows[id];
  };
  function save() {
    const state = E.load(); state.benchmark.beginnerLessons = progress; E.save(state);
    $('save-status').textContent = E.storageStatus().saved ? '進度已儲存在這個瀏覽器。' : '目前無法寫入瀏覽器；本次進度暫存記憶體，離開前請下載備份。';
    renderProgress();
  }
  function options(container, name, choices, selected) {
    container.replaceChildren();
    for (const [value, text] of choices) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'radio'; input.name = name; input.value = value; input.checked = value === selected;
      label.append(input, document.createTextNode(' '+text)); container.append(label);
    }
  }
  function renderProgress() {
    const count = lessons.filter(x => complete(progress.rows[x.id])).length;
    $('progress').textContent = `${count} / ${lessons.length} 項能力已完成練習。`;
    $('abilities').replaceChildren();
    lessons.forEach((l,i) => {
      const li = document.createElement('li'), link = document.createElement('a');
      li.append(document.createTextNode(`${complete(progress.rows[l.id]) ? '已練習' : '待練習'}：${l.ability}。`));
      link.href = '#'+l.id; link.textContent = complete(progress.rows[l.id]) ? '再看一次' : '前往練習';
      li.append(link); $('abilities').append(li);
    });
    $('next-lesson').disabled = !complete(record());
  }
  function stop() { if (timer !== null) clearInterval(timer); timer = null; $('play').textContent = '播放慢動作'; }
  function select(i, focus=false) {
    stop(); index = i; const l = lesson(), r = record();
    value = Number.isFinite(r.value) && r.value >= l.min && r.value <= l.max ? r.value : l.initial;
    phase = l.id === 'inductor' ? value/100 : .1;
    $('lesson-count').textContent = `第 ${i+1} 課 / 共 5 課`;
    $('lesson-title').textContent=l.title; $('lesson-intro').textContent=l.intro; $('focus').textContent=l.focus;
    $('question').textContent=l.question;
    options($('prediction-options'),'prediction',l.choices,r.first?.answer);
    $('prediction').disabled=!!r.first; $('predict').disabled=!!r.first;
    $('prediction-status').textContent=r.first ? '已保留首次判斷。現在動手觀察，再核對原因。' : '';
    const input=$('experiment-control'); Object.assign(input,{min:l.min,max:l.max,step:l.step,value,disabled:!r.first});
    $('control-label').textContent=l.label; $('target').textContent=`記下判斷後，把「${l.label}」調到 ${l.target}。`;
    $('explanation').open=false; $('explanation-text').textContent=l.explanation;
    $('hints').replaceChildren(); const hints=Math.min(3,Math.max(0,Number(r.hints)||0));
    for(let n=0;n<hints;n++) appendHint(n);
    $('hint').disabled=hints>=3; $('hint').textContent=hints ? '再給我一個提示' : '給我第一個提示';
    $('transfer-section').hidden=!r.observed; $('transfer-question').textContent=l.transfer;
    if(l.transferChoices) {
      const field=document.createElement('fieldset'), legend=document.createElement('legend'); legend.textContent='新條件下的判斷';
      const box=document.createElement('div'); options(box,'transfer',l.transferChoices);
      field.append(legend,box); $('transfer-controls').replaceChildren(field);
    } else {
      const label=document.createElement('label'), input=document.createElement('input');
      input.id='transfer-value'; input.type='number'; input.step='any'; label.append(document.createTextNode(`答案（${l.unit}） `),input);
      $('transfer-controls').replaceChildren(label);
    }
    $('transfer-status').textContent=r.transferPassed ? '這課的新條件練習已通過，可以再試一次。' : '';
    $('advanced-link').href=l.next; $('next-lesson').textContent=i===lessons.length-1 ? '完成入門，前往主線課程' : '下一課';
    [...$('lesson-nav').children].forEach((b,n)=>{ if(n===i)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current'); });
    render(); renderProgress(); if(focus)$('lesson-title').focus();
  }
  function render() {
    const l=lesson(), config={};
    if(l.id==='duty') config.duty=value/100;
    if(l.id==='load') config.loadOhm=value;
    model=CircuitTrainingExperiments.buck(config);
    $('control-value').textContent=value+(l.id==='duty'||l.id==='inductor'?'%':l.id==='probe'?'×':'');
    $('output-voltage').textContent=model.vout.toFixed(2)+' V'; $('actual-current').textContent=model.avgI.toFixed(2)+' A';
    $('display-metric').hidden=l.id!=='probe'; $('display-current').textContent=(model.avgI*value/10).toFixed(2)+' A';
    $('electrical-metrics').hidden=l.id==='timing';
    $('model-boundary').hidden=l.id==='timing';
    $('circuit-panel').hidden=l.id==='timing'; $('timing-panel').hidden=l.id!=='timing';
    const max=model.peakI*1.2, xy=row=>`${55+row.tUs/model.periodUs*635},${205-row.iL/max*175}`;
    $('wave-line').setAttribute('points',model.rows.map(xy).join(' '));
    $('display-line').setAttribute('points',l.id==='probe'?model.rows.map(row=>xy({...row,iL:row.iL*value/10})).join(' '):'');
    $('on-band').setAttribute('width',635*model.config.duty);
    $('peak-label').textContent=max.toFixed(1); $('period-label').textContent=model.periodUs.toFixed(0);
    $('wave-legend').textContent='實線：電路電流；底色：開關導通區間。'+(l.id==='probe'?'黃色虛線：示波器依倍率顯示的電流。':'');
    $('ready-marker').setAttribute('x1',40+value*30); $('ready-marker').setAttribute('x2',40+value*30);
    $('ready-label').setAttribute('x',Math.min(500,40+value*30)); $('ready-label').textContent=`${value} 微秒：算完`;
    $('timing-result').textContent=`${value} 微秒算完 → ${updateAt(value)} 微秒才套用新命令。`;
    $('observation').textContent=record().observed ? '已完成指定觀察。看過解釋後，試試下方的新條件題目。' : '尚未完成指定觀察。先記下判斷，再操作到目標設定。';
    drawInstant();
  }
  function drawInstant() {
    const current=model.rows[Math.round(phase*512)].iL, on=phase<model.config.duty, zero=current<1e-8;
    $('switch').setAttribute('d',on?'M140 70H200':'M140 70L200 45');
    $('on-path').style.display=on?'':'none'; $('off-path').style.display=!on&&!zero?'':'none';
    $('on-path').style.strokeDashoffset=-phase*100; $('off-path').style.strokeDashoffset=-phase*100;
    $('cursor').setAttribute('x1',55+phase*635); $('cursor').setAttribute('x2',55+phase*635);
    $('time-cursor').value=Math.round(phase*100);
    if(lesson().id==='inductor'){$('experiment-control').value=Math.round(phase*100);$('control-value').textContent=Math.round(phase*100)+'%';}
    $('instant-state').textContent=`時間 ${(phase*model.periodUs).toFixed(2)} 微秒：`+(on?'開關導通，電源供能，電感電流上升。':zero?'電感電流已歸零，二極體停止續流，由電容供應負載。':'開關關閉，二極體續流，電感電流下降。')+` 此刻 ${current.toFixed(2)} A。`;
  }
  function changeValue(v) {
    const l=lesson(),r=record(); if(!r.first)return;
    value=v; r.value=v;
    if(l.id==='inductor')phase=v/100;
    if(accepts(l.target,v))r.observed=true;
    $('transfer-section').hidden=!r.observed; render(); save();
  }
  function appendHint(n) { const li=document.createElement('li');li.textContent=lesson().hints[n];$('hints').append(li); }
  $('predict').addEventListener('click',()=>{
    const answer=document.querySelector('input[name=prediction]:checked')?.value;
    if(!answer){$('prediction-status').textContent='請先選一個判斷。';return;}
    if(record().first)return;
    record().first={answer,correct:accepts(lesson().answer,answer)};save();select(index);
  });
  $('experiment-control').addEventListener('input',e=>{stop();changeValue(Number(e.target.value));});
  $('time-cursor').addEventListener('input',e=>{stop();if(lesson().id==='inductor'&&record().first){$('experiment-control').value=e.target.value;changeValue(Number(e.target.value));}else{phase=Number(e.target.value)/100;drawInstant();}});
  $('play').addEventListener('click',()=>{if(timer!==null){stop();return;} $('play').textContent='暫停';timer=setInterval(()=>{phase=(Math.round(phase*100)+1)%100/100;drawInstant();},80);});
  $('step').addEventListener('click',()=>{stop();phase=(Math.round(phase*100)+5)%100/100;if(lesson().id==='inductor'&&record().first)changeValue(Math.round(phase*100));else drawInstant();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  $('hint').addEventListener('click',()=>{const r=record(),n=Math.min(3,Number(r.hints)||0);if(n>=3)return;appendHint(n);r.hints=n+1;r.assisted=true;$('hint').disabled=r.hints>=3;$('hint').textContent='再給我一個提示';save();});
  $('explanation').addEventListener('toggle',()=>{if($('explanation').open){record().assisted=true;save();}});
  $('transfer-submit').addEventListener('click',()=>{
    const l=lesson(),r=record();if(!r.first||!r.observed)return;
    const answer=l.transferChoices?document.querySelector('input[name=transfer]:checked')?.value:$('transfer-value').value;
    if(answer===undefined||String(answer).trim()===''){$('transfer-status').textContent='請先填寫或選擇答案。';return;}
    const correct=accepts(l.expected,answer);r.transferFirst ||= {answer,correct};r.transferAttempts=(r.transferAttempts||0)+1;
    if(correct)r.transferPassed=true;
    $('transfer-status').textContent=correct?'新條件驗證通過！這項能力已完成練習。':'還沒對。請回到觀察重點，使用分段提示，再試一次；首次答案仍會保留。';save();
  });
  $('next-lesson').addEventListener('click',()=>{if(!complete(record()))return;if(index<lessons.length-1)location.hash=lessons[index+1].id;else location.href='../19_c2000_buck_firmware_lab/index.html';});
  $('backup').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([E.exportBackup()],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='circuit-learning-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const glossary=globalThis.CircuitLearningGlossary;
  for(const [term,meaning] of Object.entries(glossary)){const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=term;p.textContent=meaning;d.append(s,p);$('glossary').append(d);}
  lessons.forEach((l,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`${i+1}. ${['導通比例','電感續流','負載變輕','量測倍率','更新時刻'][i]}`;b.addEventListener('click',()=>{if(location.hash==='#'+l.id)select(i,true);else location.hash=l.id;});$('lesson-nav').append(b);});
  function fromHash(focus=false){const i=lessons.findIndex(l=>'#'+l.id===location.hash);select(i<0?0:i,focus);}
  window.addEventListener('hashchange',()=>fromHash(true));fromHash();
})();
