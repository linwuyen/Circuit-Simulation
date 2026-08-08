(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitEngineeringChallenges = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const hash = value => {
    let h = 2166136261 >>> 0;
    for (const ch of String(value || "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  const rngFrom = seed => { let a = Number(seed) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  const pick = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  const round = (v, d) => Number(Number(v).toFixed(d == null ? 3 : d));

  const numericTemplates = [
    { id: "buck-open-inductance", moduleId: "buck", competency: "buck.current-ripple.relationship", unit: "uH", tolerance: 0.05 },
    { id: "adc-open-divider", moduleId: "adc", competency: "adc.divider.power", unit: "kOhm", tolerance: 0.03 },
    { id: "spi-open-frame-time", moduleId: "spi", competency: "spi.throughput.clock", unit: "us", tolerance: 0.02 }
  ];

  function instantiateNumeric(taskId, seed) {
    const template = numericTemplates.find(item => item.id === taskId);
    if (!template) throw new Error("unknown numeric task");
    const numericSeed = Number(seed || 0), rng = rngFrom(hash(`${taskId}:${numericSeed}`));
    if (taskId === "buck-open-inductance") {
      const base = numericSeed === 0 ? { vin: 48, vout: 12, fswKHz: 100, iout: 5, ripplePct: 20 } : {
        vin: pick([24, 36, 48, 60, 72], rng), vout: pick([5, 9, 12, 15, 18], rng), fswKHz: pick([80, 100, 125, 200, 250], rng), iout: pick([2, 3, 4, 5, 6], rng), ripplePct: pick([15, 20, 25, 30], rng)
      };
      if (base.vout >= base.vin) base.vout = Math.max(3, Math.round(base.vin / 4));
      const targetA = base.iout * base.ripplePct / 100, duty = base.vout / base.vin;
      const expected = (base.vin - base.vout) * duty / (base.fswKHz * 1e3 * targetA) * 1e6;
      return { ...template, seed: numericSeed, parameters: base, prompt: `Vin=${base.vin} V、Vout=${base.vout} V、fsw=${base.fswKHz} kHz、Iout=${base.iout} A。希望 CCM ΔI=${base.ripplePct}% Iout，理想模型下 L 約多少？`, expected: () => expected, explanation: "先算 D=Vout/Vin，再由 ΔI=(Vin−Vout)D/(fsw·L) 反解 L。" };
    }
    if (taskId === "adc-open-divider") {
      const base = numericSeed === 0 ? { bus: 800, vref: 3.3, rbotK: 8.25 } : { bus: pick([300,400,600,800,1000],rng), vref: pick([3.0,3.3,4.096,5.0],rng), rbotK: pick([3.3,4.7,6.8,8.2,10],rng) };
      const expected = base.rbotK * (base.bus / base.vref - 1);
      return { ...template, seed: numericSeed, parameters: base, prompt: `Vbus,max=${base.bus} V、Vref=${base.vref} V、Rbot=${base.rbotK} kΩ。忽略 ADC loading，要讓 Vadc≤Vref，Rtop 最小約多少？`, expected: () => expected, explanation: "由 Vadc=Vbus·Rbot/(Rtop+Rbot) 反解 Rtop。" };
    }
    const base = numericSeed === 0 ? { mhz: 10, bits: 32 } : { mhz: pick([2,5,8,10,20,25],rng), bits: pick([8,12,16,24,32,48],rng) };
    const expected = base.bits / base.mhz;
    return { ...template, seed: numericSeed, parameters: base, prompt: `SPI SCLK=${base.mhz} MHz、frame=${base.bits} bit，忽略 frame gap。單一 frame 最低線上時間是多少？`, expected: () => expected, explanation: "frame time = bits / SCLK。" };
  }

  const numericTasks = numericTemplates.map(task => instantiateNumeric(task.id, 0));

  function evaluateNumeric(taskId, answer, unit, seed) {
    const task = instantiateNumeric(taskId, seed || 0), value = Number(answer);
    if (!Number.isFinite(value)) return { correct:false,reason:"not-a-number",expected:task.expected(),unit:task.unit,seed:task.seed,parameters:task.parameters };
    let normalized=value; const entered=String(unit||task.unit).toLowerCase();
    if(task.unit==="uH"&&entered==="h")normalized*=1e6;
    if(task.unit==="uH"&&entered==="mh")normalized*=1e3;
    if(task.unit==="kOhm"&&(entered==="ohm"||entered==="ω"))normalized/=1e3;
    if(task.unit==="us"&&entered==="s")normalized*=1e6;
    if(task.unit==="us"&&entered==="ms")normalized*=1e3;
    const expected=task.expected(), relativeError=expected?Math.abs(normalized-expected)/Math.abs(expected):Math.abs(normalized-expected);
    return{correct:relativeError<=task.tolerance,expected,normalized,unit:task.unit,relativeError,explanation:task.explanation,seed:task.seed,parameters:task.parameters};
  }

  const diagnosticGames = [
    {
      id:"spi-overrun-game",moduleId:"spi",title:"SPI 偶發漏 word",symptom:"Master 連續送 frame；示波器看 SCLK/MOSI 正常，但 Slave 偶爾少一個 word。",rootCauseId:"fifo-service",
      causes:[{id:"fifo-service",text:"RX FIFO 服務延遲超過 deadline",prior:0.45},{id:"cpol",text:"CPOL/CPHA 固定錯誤",prior:0.25},{id:"mosi-level",text:"MOSI 邏輯準位不足",prior:0.30}],
      tests:[
        {id:"fifo-level",text:"量 RX FIFO level / overflow flag 與 ISR/DMA 時序",cost:1,result:"漏字前 FIFO level 到頂，overflow flag 置位；MOSI/SCLK 無異常。",likelihood:{"fifo-service":0.96,cpol:0.08,"mosi-level":0.10}},
        {id:"scope-mosi",text:"再量一次 MOSI 波形",cost:2,result:"MOSI 邊緣與邏輯準位正常，無法解釋偶發漏字。",likelihood:{"fifo-service":0.75,cpol:0.55,"mosi-level":0.12}},
        {id:"change-cpol",text:"切換 CPOL/CPHA",cost:3,result:"錯誤型態變成每個 word 固定錯位，不符合原症狀。",likelihood:{"fifo-service":0.70,cpol:0.18,"mosi-level":0.45}},
        {id:"slow-sclk",text:"SCLK 降半",cost:2,result:"漏字明顯減少，支持服務 deadline 假設，但仍需看 FIFO/ISR 才能定因。",likelihood:{"fifo-service":0.88,cpol:0.35,"mosi-level":0.50}}
      ]
    },
    {
      id:"buck-dcm-game",moduleId:"buck",title:"Buck 輕載輸出偏離",symptom:"重載時 Vout≈Vin·D；負載變輕後同一 Duty 下 Vout 開始偏離。",rootCauseId:"dcm",
      causes:[{id:"dcm",text:"電感電流進入 DCM，CCM 轉移關係失效",prior:0.50},{id:"adc",text:"ADC 量化不足",prior:0.20},{id:"esr",text:"輸出電容 ESR 單獨造成 DC gain 改變",prior:0.30}],
      tests:[
        {id:"inductor-current",text:"量電感電流谷值是否碰到 0",cost:1,result:"輕載時每週期都有一段電感電流為 0。",likelihood:{dcm:0.97,adc:0.05,esr:0.04}},
        {id:"swap-cap",text:"換低 ESR 電容",cost:3,result:"高頻 ripple 改善，但 DC 偏離仍在。",likelihood:{dcm:0.82,adc:0.62,esr:0.15}},
        {id:"adc-bits",text:"提高 ADC oversampling",cost:2,result:"讀值更平滑，但轉移關係偏離不變。",likelihood:{dcm:0.80,adc:0.18,esr:0.66}}
      ]
    }
  ];

  function normalizedPrior(game) {
    const values=Object.fromEntries(game.causes.map(c=>[c.id,Math.max(0,Number(c.prior==null?1:c.prior))]));
    const total=Object.values(values).reduce((s,v)=>s+v,0)||1; Object.keys(values).forEach(k=>values[k]/=total); return values;
  }
  function entropy(distribution) { return Object.values(distribution||{}).reduce((sum,p)=>p>0?sum-p*Math.log2(p):sum,0); }
  function updatePosterior(prior, likelihood) {
    const raw={}, keys=Object.keys(prior||{}); let total=0;
    keys.forEach(k=>{raw[k]=Math.max(0,prior[k])*Math.max(0,Number(likelihood&&likelihood[k]||0));total+=raw[k];});
    if(!total)return{...prior}; keys.forEach(k=>raw[k]/=total); return raw;
  }
  function diagnosticTrace(gameId, selectedTests) {
    const game=diagnosticGames.find(item=>item.id===gameId); if(!game)throw new Error("unknown diagnostic game");
    let posterior=normalizedPrior(game), totalCost=0, totalInformationGain=0; const initialEntropy=entropy(posterior),steps=[];
    (selectedTests||[]).forEach(id=>{const test=game.tests.find(x=>x.id===id);if(!test)return;const before={...posterior},h0=entropy(before);posterior=updatePosterior(before,test.likelihood);const h1=entropy(posterior),ig=Math.max(0,h0-h1);totalCost+=test.cost;totalInformationGain+=ig;steps.push({testId:test.id,text:test.text,result:test.result,cost:test.cost,before,posterior:{...posterior},informationGain:ig,entropyBefore:h0,entropyAfter:h1});});
    return{gameId,initial:normalizedPrior(game),posterior,initialEntropy,finalEntropy:entropy(posterior),informationGain:totalInformationGain,cost:totalCost,steps};
  }
  function scoreDiagnostic(gameId, selectedTests, causeId) {
    const game=diagnosticGames.find(item=>item.id===gameId); if(!game)throw new Error("unknown diagnostic game");
    const trace=diagnosticTrace(gameId,selectedTests),solved=causeId===game.rootCauseId,posteriorRoot=Number(trace.posterior[game.rootCauseId]||0),fraction=trace.initialEntropy?Math.min(1,trace.informationGain/trace.initialEntropy):0;
    const efficiency=solved?Math.max(0,Math.min(100,Math.round(55+35*fraction+20*posteriorRoot-trace.cost*6))):0;
    return{solved,cost:trace.cost,informationGain:trace.informationGain,efficiency,rootCauseId:game.rootCauseId,posterior:trace.posterior,posteriorRoot,initialEntropy:trace.initialEntropy,finalEntropy:trace.finalEntropy,steps:trace.steps};
  }

  return{numericTasks,numericTemplates,instantiateNumeric,evaluateNumeric,diagnosticGames,entropy,updatePosterior,diagnosticTrace,scoreDiagnostic};
});