(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const num = id => Number($(id)?.value);
  const hz = value => value >= 1e6 ? `${(value/1e6).toFixed(2)} MHz` : value >= 1000 ? `${(value/1000).toFixed(2)} kHz` : `${value.toFixed(1)} Hz`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function loadModel() {
    if (window.CircuitTopologyTransferV1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "../assets/learning/topology-transfer-v1.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("topology-transfer-v1.js load failed"));
      document.head.appendChild(script);
    });
  }

  function appendSurface() {
    if ($("p5TransferVerification")) return;
    const main = document.querySelector("main");
    if (!main) return;
    const section = document.createElement("section");
    section.className = "panel";
    section.id = "p5TransferVerification";
    section.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">P5 · 固定觀念練習</p><h2>不要把 Buck 的直覺硬套到別的 power stage</h2></div><span class="badge exact">shared executable model</span></div>
      <p class="lead">這裡不再新增公式清單，而是把目前各 topology 的 operating point 轉成「第一個必須尊重的 constraint」。改上面的 slider，這些 constraint 會同步更新。</p>
      <div class="metric-grid" id="p5ConstraintGrid"></div>
      <div class="cause-chain"><span>Buck grammar</span><b>→</b><span>same r→e→C→u→P→y</span><b>→</b><span>topology-specific constraint</span><b>→</b><span>next measurement / bandwidth decision</span></div>
      <div class="section-head"><div><p class="eyebrow">FIRST ATTEMPT</p><h3>五個電路觀念，重看你的首次判斷</h3></div><span id="p5ChallengeScore">0/5</span></div>
      <div id="p5ChallengeList"></div>
      <p class="boundary">這五題是固定的教學練習，不是陌生題驗證，也不授予正式能力成績。首次作答保存在學習備份中；真板驗證仍由 Module 19 的實體證據判定。</p>`;
    main.appendChild(section);
  }

  function constraintRows(Model) {
    const rows = [];
    try {
      const x = Model.transferConstraint("boost", { vin:num("vinBoost"), duty:num("dutyBoost")/100, inductanceH:num("lBoost")*1e-6, loadOhm:num("rBoost") });
      rows.push({ name:"BOOST", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("pfc", { vrms:num("pfcVrms"), powerW:num("pfcPower"), vbus:num("pfcBus"), busCapF:num("pfcC")*1e-6, lineHz:num("pfcHz") });
      rows.push({ name:"PFC", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("psfb", { vin:num("psfbVin"), phaseDeg:num("psfbPhase"), turnsRatio:num("psfbN"), leakageH:num("psfbLlk")*1e-6, primaryCurrentA:num("psfbI"), commutationCapF:num("psfbCoss")*1e-9 });
      rows.push({ name:"PSFB", key:x.constraint, value:`${Number(x.value).toFixed(2)}×`, hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("llc", { resonantInductanceH:num("llcLr")*1e-6, resonantCapF:num("llcCr")*1e-9, magnetizingInductanceH:num("llcLm")*1e-6, q:num("llcQ"), switchingHz:num("llcFs")*1e3 });
      rows.push({ name:"LLC", key:x.constraint, value:Number(x.value).toFixed(3), hint:x.designHint });
    } catch (_) {}
    try {
      const x = Model.transferConstraint("inverter", { mode:$("invMode")?.value || "lcl", dcBusV:num("invVdc"), modulationIndex:num("invM"), l1H:num("invL1")*1e-3, capF:num("invC")*1e-6, l2H:num("invL2")*1e-3 });
      rows.push({ name:"INVERTER", key:x.constraint, value:hz(x.valueHz), hint:x.designHint });
    } catch (_) {}
    return rows;
  }

  function renderConstraints(Model) {
    const grid = $("p5ConstraintGrid"); if (!grid) return;
    grid.innerHTML = constraintRows(Model).map(row => `<div data-p5-constraint="${row.name.toLowerCase()}"><span>${escapeHtml(row.name)} · ${escapeHtml(row.key)}</span><strong>${escapeHtml(row.value)}</strong><small>${escapeHtml(row.hint)}</small></div>`).join("");
  }

  function renderChallenges(Model) {
    const list = $("p5ChallengeList"); if (!list) return;
    const cases = Model.challengeSet(20260821);
    const E=window.CircuitEvidence;
    if(!E){list.textContent='學習紀錄尚未載入，暫不接受作答。';return;}
    const stored=E.load().benchmark.learningWorkspace?.topologyConcepts;
    const rows=stored?.version===1&&stored.rows&&typeof stored.rows==='object'&&!Array.isArray(stored.rows)?stored.rows:{};
    const first = new Map(cases.filter(c=>rows[c.id]?.first&&c.choices.includes(rows[c.id].first.answer)).map(c=>[c.id,rows[c.id].first.answer]));
    function persist(){const state=E.load();state.benchmark.learningWorkspace||={version:1};state.benchmark.learningWorkspace.topologyConcepts={version:1,rows};E.save(state);}
    function show(card,item){const answer=first.get(item.id);card.querySelector('[data-p5-result]').textContent=answer===undefined?'尚未作答':answer===item.expected?'✓ 首次判斷符合模型':'首次判斷已保留：'+answer+'；對照原因後的正確選項：'+item.expected;}

    const score = () => {
      const correct = [...first.entries()].filter(([id,answer]) => cases.find(item=>item.id===id)?.expected === answer).length;
      $("p5ChallengeScore").textContent = `${correct}/${cases.length} 首次符合模型`;
    };
    list.innerHTML = cases.map(item => `<article class="explain-card" data-p5-case="${item.id}"><h3>${escapeHtml(item.topology.toUpperCase())}</h3><p>${escapeHtml(item.prompt)}</p><div class="topology-nav">${item.choices.map(choice=>`<button type="button" data-p5-answer="${escapeHtml(choice)}">${escapeHtml(choice)}</button>`).join("")}</div><small data-p5-result>First attempt 尚未作答</small></article>`).join("");
    list.querySelectorAll("[data-p5-case]").forEach(card => card.querySelectorAll("[data-p5-answer]").forEach(button => button.addEventListener("click", () => {
      const item = cases.find(row=>row.id===card.dataset.p5Case);
      if (!first.has(item.id)) {first.set(item.id, button.dataset.p5Answer);rows[item.id]={first:{answer:button.dataset.p5Answer,correct:button.dataset.p5Answer===item.expected,at:new Date().toISOString()}};persist();}
      show(card,item);
      score();
    })));
    list.querySelectorAll("[data-p5-case]").forEach(card=>show(card,cases.find(c=>c.id===card.dataset.p5Case)));
    score();
  }

  async function init() {
    appendSurface();
    try { await loadModel(); }
    catch (error) { $("p5ConstraintGrid").textContent = error.message; return; }
    const Model = window.CircuitTopologyTransferV1;
    renderConstraints(Model);
    renderChallenges(Model);
    document.querySelectorAll("input,select").forEach(input => input.addEventListener("input", () => renderConstraints(Model)));
  }

  function sharedContext(){
    const E=window.CircuitEvidence,record=E?.load().benchmark.learningWorkspace?.topologyTransfer;
    if(!record?.params)return;
    const panel=document.createElement('section');panel.id='workspace-transfer';panel.className='panel';
    const heading=document.createElement('h2');heading.textContent='沿用工作台的比較條件';panel.append(heading);
    const note=document.createElement('p');note.textContent='這份設定來自降壓／升壓比較。按下套用後，更新兩種電路的輸入、開關比例與元件；頁面操作不會改寫原作答。Boost 的頻率響應仍是理想 CCM 解析模型。';panel.append(note);
    const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
    const button=document.createElement('button');button.id='apply-workspace-topology';button.textContent='套用同一份比較條件';panel.append(button);
    const a=document.createElement('a');a.href='../index.html#topology';a.textContent='返回比較，接續作答';a.style.margin='1rem';panel.append(a);
    document.querySelector('main').prepend(panel);
    button.onclick=()=>{
      const p=record.params,values={vinBuck:p.vin,vinBoost:p.vin,dutyBuck:p.duty*100,dutyBoost:p.duty*100,lBuck:p.inductanceH*1e6,lBoost:p.inductanceH*1e6,cBuck:p.capacitanceF*1e6,cBoost:p.capacitanceF*1e6,rBuck:p.loadOhm,rBoost:p.loadOhm,esrBuck:p.esrOhm*1e3,fsBuck:p.switchingHz/1e3};
      for(const[id,value]of Object.entries(values)){const input=$(id),min=id==='esrBuck'?0:Number(input.min),max=Number(input.max),step=Number(input.step||1);if(!Number.isFinite(value)||value<min||value>max||Math.abs((value-min)/step-Math.round((value-min)/step))>1e-7){status.textContent='這份條件超出工具可精確設定的範圍：'+id+'。尚未套用任何改動。';return;}}
      $('esrBuck').min='0';for(const[id,value]of Object.entries(values))$(id).value=String(value);
      for(const id of Object.keys(values))$(id).dispatchEvent(new Event('input',{bubbles:true}));
      status.textContent='已套用：輸入 '+p.vin+' V、開關 '+(p.duty*100).toFixed(0)+'%、電感 '+(p.inductanceH*1e6).toFixed(0)+' µH、電容 '+(p.capacitanceF*1e6).toFixed(0)+' µF、負載 '+p.loadOhm+' Ω。原作答保留。';
    };
  }
  const start=()=>{init();sharedContext();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
