(function(root){
  "use strict";
  const Learning=root.CircuitLearning;if(!Learning)return;
  const esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);
  const layers=[
    {n:"1",title:"Power Physics",why:"先知道能量與 switching topology 怎麼流。",items:[["0_buck_converter_/index.html","Buck"],["2_code_artifact/index.html","Inverter"],["9_afe/index.html","AFE"],["10_acmc_pro/index.html","ACMC"]]},
    {n:"2",title:"Sensing",why:"把 physical quantity 可靠地轉成 MCU 看得懂的資料。",items:[["1_c2000_adc_calculator/index.html","ADC / Scaling"],["12_opamp_slew_rate/index.html","OP AMP"]]},
    {n:"3",title:"Timing & Control",why:"sample、compute、actuate 必須形成可預測的閉迴路。",items:[["4_PI/index.html","PI"],["3_foc_course/index.html","FOC"],["6_10us_loop/index.html","10 µs Loop"],["13_power_sync/index.html","PWM→ADC Sync"]]},
    {n:"4",title:"Protection & State",why:"fault path 要短、fail-closed，recovery 要有 owner。",items:[["14_power_protection/index.html","Protection"],["7_bms/index.html","BMS"]]},
    {n:"5",title:"Communication & Actuation",why:"command、waveform 與資料 ownership 不能破壞 real-time contract。",items:[["5_spi/index.html","SPI"],["8.ad5543_simulator/index.html","AD5543"],["11_c2000_dds/index.html","DDS"]]},
    {n:"6",title:"System Integration",why:"把 requirement → sensing → control → PWM → protection → diagnosis 串成一條因果鏈。",items:[["15_power_capstone/index.html","Programmable Power Converter Capstone"]]}
  ];
  function pathHtml(){return `<section class="section-head" id="powerFirmwarePath"><h2>Power Electronics Firmware Engineer Path</h2><p class="muted">不是追 module 數量；沿著 physical power → sensing → real-time control → protection → communication → system diagnosis 建立可遷移能力。</p></section><section class="lab-grid">${layers.map(l=>`<article class="lab"><div class="lesson-meta"><span class="tag blue">Layer ${esc(l.n)}</span></div><h3>${esc(l.title)}</h3><p>${esc(l.why)}</p><div class="actions">${l.items.map(i=>`<a class="button" href="${esc(i[0])}">${esc(i[1])}</a>`).join("")}</div></article>`).join("")}</section>`;}
  function ladderHtml(){const levels=[["L0","Recognize","辨認元件/訊號/狀態"],["L1","Calculate","算出量級與 unit"],["L2","Predict","操作前先預測方向"],["L3","Measure","選下一個最有資訊量的 measurement"],["L4","Diagnose","由 evidence 收斂 root cause"],["L5","Design","從 requirement 反推參數與 contract"],["L6","Integrate","串起 sensing/control/protection/communication"],["L7","Debug unknown","面對沒看過的 system 仍能逐層證偽"]];return `<section class="section-head" id="engineeringCapabilityLadder"><h2>Engineering Capability Ladder</h2><p class="muted">最高目標不是背公式，而是未知情境中的 first-attempt engineering judgment。</p></section><section class="fault-table">${levels.map(x=>`<article class="fault-row"><div><b>${x[0]}</b><span class="tag">${x[1]}</span></div><div><b>能力</b><p>${x[2]}</p></div></article>`).join("")}</section>`;}
  function fix(){
    document.querySelectorAll('.v8-validity-summary').forEach(el=>{el.innerHTML=el.innerHTML.replace(/(\d+)\/13 modules anchored/g,'$1/16 modules anchored').replace(/(\d+)\/12 modules anchored/g,'$1/16 modules anchored');});
    const main=document.getElementById("mainContent");if(!main)return;
    if(!document.getElementById("powerFirmwarePath")){const target=main.querySelector('.mode-grid')||main.querySelector('.progress-list')||main.querySelector('.section-head');if(target)target.insertAdjacentHTML('beforebegin',pathHtml());else main.insertAdjacentHTML('beforeend',pathHtml());}
    if(location.pathname.toLowerCase().endsWith('progress.html')&&!document.getElementById("engineeringCapabilityLadder"))main.insertAdjacentHTML('beforeend',ladderHtml());
    const d=document.getElementById('diagnosticCoverageV8');if(d&&!/PWM\/ADC Sync/.test(d.textContent))d.innerHTML=d.innerHTML.replace('ACMC / OP AMP。','ACMC / OP AMP / PWM/ADC Sync / Protection / System Integration。');
  }
  ['renderHome','renderProgress','renderLabs','renderTrouble','renderQuiz','renderReport'].forEach(name=>{const original=Learning[name];if(typeof original!=="function"||original.__powerFirmwarePost)return;const wrapped=function(){const value=original.apply(this,arguments);fix();return value;};wrapped.__powerFirmwarePost=true;Learning[name]=wrapped;});
  root.CircuitPowerFirmwarePost={version:'1.0.0',layers,fix};
})(window);
