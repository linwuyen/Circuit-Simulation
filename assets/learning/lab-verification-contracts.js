(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CircuitLabVerificationContracts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const A = "A", B = "B";
  const independent = (labId, moduleId, title, modelScope, reasoning) => ({
    labId, moduleId, title, method: "independent-oracle", gradeCeiling: A,
    modelScope, requires: ["preregistered-prediction", "machine-snapshot", "independent-oracle", "reasoning-gate"],
    reasoning: reasoning || {}
  });
  const machine = (labId, moduleId, title, modelScope) => ({
    labId, moduleId, title, method: "machine-contract", gradeCeiling: B,
    modelScope: modelScope || "interactive-engineering-judgment",
    requires: ["preregistered-prediction", "machine-snapshot", "reasoning-rubric"]
  });

  const list = [
    independent("buck.lab.buck-ripple","buck","20% Buck current ripple","physical-approximation",{
      mechanism:[["di/dt","伏秒","反比"],["l","電感","fsw","頻率"]], boundary:[["dcm","pulse","burst","dcr","壓降","非理想"]]
    }),
    machine("buck.lab.buck-output-ripple","buck","Buck output ripple decomposition","interactive-model"),
    machine("buck.lab.buck-dcm","buck","CCM/DCM boundary exploration","interactive-model"),

    machine("adc.lab.adc-offset","adc","Bidirectional current measurement range","interactive-model"),
    independent("adc.lab.adc-divider","adc","High-voltage divider","physical-calculation",{
      mechanism:[["分壓","ohm","歐姆","串聯","電阻"],["電流","電壓","比例"]], boundary:[["loading","取樣","箝位","容差","功耗","工作電壓","vref"]]
    }),
    machine("adc.lab.adc-code","adc","Firmware scaling coefficients","interactive-model"),

    independent("inverter.lab.inv-shoot","inverter","Half-bridge shoot-through invariant","state-invariant",{
      mechanism:[["上下管","q1","q2","同時導通","直通","shoot"],["短路","母線","dead-time","死區"]], boundary:[["死區","turn-off","延遲","寄生","driver","驅動"]]
    }),
    machine("inverter.lab.inv-filter","inverter","LC filter tuning","interactive-model"),
    machine("inverter.lab.inv-thd","inverter","SPWM/SVPWM comparison","interactive-model"),

    independent("foc.lab.foc-park","foc","Park transform locked-frame invariant","coordinate-transform",{
      mechanism:[["park","dq","座標","旋轉"],["theta","θ","角度","轉子"]], boundary:[["相序","角度","offset","gain","同步","scaling"]]
    }),
    machine("foc.lab.foc-fault","foc","FOC waveform fault identification","diagnostic-judgment"),
    machine("foc.lab.foc-dict","foc","FOC fault dictionary","human-diagnostic-artifact"),

    machine("pi.lab.pi-tune","pi","PI stability tuning","interactive-control-model"),
    independent("pi.lab.pi-ki","pi","Integrator crossover identity","analytic-control-identity",{
      mechanism:[["ki","積分"],["2π","2pi","0db","-20","−20","-90","−90"]], boundary:[["離散","sampling","取樣","飽和","plant","受控體","延遲"]]
    }),
    machine("pi.lab.pi-challenge","pi","PI stability challenge","interactive-control-model"),

    machine("spi.lab.spi-mode","spi","SPI mode discrimination","protocol-judgment"),
    independent("spi.lab.spi-fifo","spi","SPI FIFO service-rate invariant","timing-model",{
      mechanism:[["ta","到達","sclk"],["ts","服務","fifo","isr","dma"]], boundary:[["gap","burst","fifo","dma","isr","latency","延遲"]]
    }),
    machine("spi.lab.spi-wire","spi","SPI wiring checklist","procedural-contract"),

    independent("loop10us.lab.loop-budget","loop10us","10us critical-path budget","timing-model",{
      mechanism:[["10μs","10us","100khz","critical","關鍵路徑"],["acq","cpu","fsi","margin","餘裕"]], boundary:[["jitter","延遲","worst","最差","acq","payload","timeout","逾時"]]
    }),
    machine("loop10us.lab.loop-acqps","loop10us","ADC acquisition lower bound","interactive-timing-model"),
    machine("loop10us.lab.loop-fsi","loop10us","FSI payload timing","interactive-timing-model"),

    machine("bms.lab.bms-chain","bms","BMS measurement-to-actuation chain","systems-reasoning"),
    machine("bms.lab.bms-uds","bms","UDS unlock sequence","protocol-procedure"),
    independent("bms.lab.bms-failsafe","bms","BMS fail-safe convergence invariant","state-invariant",{
      mechanism:[["fault_lock","fault","鎖定"],["contactor","接觸器","open","斷開","watchdog","看門狗"]], boundary:[["reset","復歸","清除","診斷","真故障","失聯"]]
    }),

    independent("ad5543.lab.dac-code","ad5543","AD5543 target-to-code mapping","analytic-code-mapping",{
      mechanism:[["d","code","碼","2^16","65536"],["vref","比例","極性","反相"]], boundary:[["飽和","clamp","範圍","vref","gain","offset","誤差"]]
    }),
    machine("ad5543.lab.dac-cal","ad5543","DAC offset/gain calibration","calibration-procedure"),
    machine("ad5543.lab.dac-polarity","ad5543","DAC polarity verification","topology-judgment"),

    independent("afe.lab.afe-phase","afe","AFE phase/power-direction identity","analytic-ac-power",{
      mechanism:[["cos","pf","功率因數"],["phase","相位","實功","p","方向"]], boundary:[["thd","失真","取樣","極性","pll","諧波"]]
    }),
    machine("afe.lab.afe-pi","afe","AFE PI tuning","interactive-control-model"),
    machine("afe.lab.afe-record","afe","AFE experiment record","human-traceability-artifact"),

    machine("acmc-pro.lab.acmc-zvs","acmc-pro","ZVS light-load boundary","heuristic-trend-contract"),
    machine("acmc-pro.lab.acmc-sampling","acmc-pro","Synchronous/asynchronous sampling comparison","heuristic-trend-contract"),
    independent("acmc-pro.lab.acmc-protection","acmc-pro","OCP/DC-SAT teaching protection rule","teaching-estimate",{
      mechanism:[["peak","峰值","ocp"],["offset","偏壓","dc sat","磁飽和"]], boundary:[["220","pf","阻性","估算","回授","瞬時","模型"]]
    }),
    machine("acmc-pro.lab.acmc-full","acmc-pro","Integrated ACMC teaching acceptance","heuristic-multicriteria-contract"),

    machine("c2000-dds.lab.dds-offset","c2000-dds","DDS/ADC offset calibration","simplified-calibration-model"),
    independent("c2000-dds.lab.dds-pf","c2000-dds","Sinusoidal real-power/PF identity","analytic-ac-power",{
      mechanism:[["p","實功","mean","平均"],["vrms","irms","va","pf","cos","相位"]], boundary:[["thd","失真","諧波","同步","極性","取樣"]]
    }),
    machine("c2000-dds.lab.dds-jitter","c2000-dds","Zero-crossing jitter exploration","heuristic-event-contract"),
    machine("c2000-dds.lab.dds-cal","c2000-dds","Measurement calibration integration","teaching-acceptance-contract")
  ];

  const byId = Object.fromEntries(list.map(item => [item.labId, item]));
  const text = value => String(value || "").toLowerCase();
  function hasAny(value, words) { const s=text(value); return (words||[]).some(word => s.includes(text(word))); }
  function reasoningGate(labId, draft) {
    const contract = byId[labId];
    if (!contract || contract.gradeCeiling !== A) return { passed:true, checks:[] };
    const profile=contract.reasoning||{}, explanation=draft&&draft.explanation||"", limitations=draft&&draft.limitations||"";
    const mechanism=(profile.mechanism||[]).map(group=>hasAny(explanation,group));
    const boundary=(profile.boundary||[]).map(group=>hasAny(limitations,group));
    const checks=[...mechanism.map((ok,i)=>({name:`mechanism-${i+1}`,ok})),...boundary.map((ok,i)=>({name:`boundary-${i+1}`,ok}))];
    return { passed:checks.every(item=>item.ok), checks };
  }

  function validate(curriculum, oracleApi) {
    const labs=(curriculum&&curriculum.modules||[]).flatMap(module=>(module.labs||[]).map(lab=>lab.id));
    const labSet=new Set(labs), errors=[];
    labs.forEach(id=>{ if(!byId[id]) errors.push("unclassified lab: "+id); });
    list.forEach(item=>{ if(!labSet.has(item.labId)) errors.push("contract for unknown lab: "+item.labId); });
    list.filter(item=>item.gradeCeiling===A).forEach(item=>{ if(!oracleApi||typeof oracleApi.supports!=="function"||!oracleApi.supports(item.labId)) errors.push("A contract without oracle: "+item.labId); });
    const modules=(curriculum&&curriculum.modules||[]).map(module=>module.id);
    modules.forEach(moduleId=>{ if(!list.some(item=>item.moduleId===moduleId&&item.gradeCeiling===A)) errors.push("module has no A-capable lab: "+moduleId); });
    return errors;
  }

  function coverage(curriculum) {
    const labs=(curriculum&&curriculum.modules||[]).flatMap(module=>(module.labs||[]).map(lab=>lab.id));
    const classified=labs.filter(id=>!!byId[id]);
    const aCapable=classified.filter(id=>byId[id].gradeCeiling===A);
    return {
      total:labs.length, classified:classified.length, unclassified:labs.filter(id=>!byId[id]), aCapable:aCapable.length,
      modules:(curriculum&&curriculum.modules||[]).map(module=>({moduleId:module.id,total:module.labs.length,classified:module.labs.filter(l=>byId[l.id]).length,aCapable:module.labs.filter(l=>byId[l.id]&&byId[l.id].gradeCeiling===A).length}))
    };
  }

  return { VERSION, list, get:labId=>byId[labId]||null, validate, coverage, reasoningGate };
});