(function(root,factory){
  const api=factory(root, typeof require==="function" ? require("./topology-transfer-v1.js") : root.CircuitTopologyTransferV1);
  if(typeof module==="object"&&module.exports)module.exports=api;
  root.CircuitTIConceptLabs=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root,T){
  "use strict";
  const pi=Math.PI;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const linspace=(a,b,n)=>Array.from({length:n},(_,i)=>a+(b-a)*i/(n-1));

  const labs={
    "buck-energy-flow":{
      kind:"power-stage",route:"#ti-learning",
      choices:[["time","先改 ON/OFF 作用時間"],["slope","di/dt 立刻一起變陡"],["jump","iL 瞬間跳值"]],expected:"time",
      evaluate:()=>({summary:"Dedicated first-cycle Buck lab",metrics:{route:"learn.html#ti-learning"},boundary:"Use dedicated Buck first-cycle lab."})
    },
    "boost-rhpz":{
      kind:"topology",defaults:{vin:48,duty:.5,inductanceH:200e-6,capacitanceF:470e-6,loadOhm:20,switchingHz:100e3},
      choices:[["dip","Vout 可先往下，再往上"],["up","Vout 只會立刻往上"],["same","完全不動"]],expected:"dip",
      evaluate:p=>{const x=T.boostCCM({...labs["boost-rhpz"].defaults,...p});return{summary:"More ON time temporarily reduces diode delivery before stored energy reaches output.",metrics:{vout:x.vout,rhpzHz:x.rhpzHz,fcConservative:x.conservativeFcHz},boundary:"Ideal CCM averaged Boost; RHPZ claim only inside CCM."};}
    },
    "current-mode-slope-comp":{
      kind:"sampled-current",defaults:{vin:48,vout:30,inductanceH:100e-6,slopeCompAUs:.05},
      choices:[["alt","相鄰週期 peak high/low 交替"],["slow","只出現低頻緩慢振盪"],["none","50% 以上 duty 不影響"]],expected:"alt",
      evaluate:p=>{const c={...labs["current-mode-slope-comp"].defaults,...p},L=c.inductanceH,m1=(c.vin-c.vout)/L/1e6,m2=c.vout/L/1e6,ma=c.slopeCompAUs,k=-(m2-ma)/(m1+ma);return{summary:"Peak-current perturbation evolves cycle to cycle; |k|>1 means alternating perturbations grow.",metrics:{m1AUs:m1,m2AUs:m2,slopeCompAUs:ma,perturbationRatio:k,stable:Math.abs(k)<1},series:Array.from({length:10},(_,n)=>({n,value:Math.pow(k,n)})),boundary:"Teaching sampled-data perturbation recurrence, not comparator/noise/device model."};}
    },
    "average-current-mode":{
      kind:"current-loop",defaults:{initialA:2,referenceA:4,bandwidthHz:3000,delayUs:20},
      choices:[["cmd","current reference / controller command 先動"],["vout","Vout 先大幅改變"],["nothing","所有訊號同時不動"]],expected:"cmd",
      evaluate:p=>{const c={...labs["average-current-mode"].defaults,...p},rows=linspace(0,1.5e-3,90).map(t=>({tMs:t*1e3,current:t<c.delayUs*1e-6?c.initialA:c.referenceA-(c.referenceA-c.initialA)*Math.exp(-2*pi*c.bandwidthHz*(t-c.delayUs*1e-6))}));return{summary:"Inner current loop should respond before the slower voltage loop.",metrics:{bandwidthHz:c.bandwidthHz,delayUs:c.delayUs,tauUs:1/(2*pi*c.bandwidthHz)*1e6},series:rows,boundary:"First-order inner-loop teaching model."};}
    },
    "loop-stability":{
      kind:"frequency",defaults:{crossoverHz:3000,basePhaseMarginDeg:60,delayUs:20},
      choices:[["less","phase margin 下降"],["more","phase margin 上升"],["same","完全不變"]],expected:"less",
      evaluate:p=>{const c={...labs["loop-stability"].defaults,...p},loss=360*c.crossoverHz*c.delayUs*1e-6,pm=c.basePhaseMarginDeg-loss;return{summary:"Pure delay adds phase lag proportional to frequency.",metrics:{crossoverHz:c.crossoverHz,delayPhaseDeg:-loss,phaseMarginDeg:pm},series:linspace(100,20000,80).map(f=>({f,delayPhaseDeg:-360*f*c.delayUs*1e-6})),boundary:"Delay-only margin delta; plant/controller poles and zeros must be added separately."};}
    },
    "pi-zero-placement":{
      kind:"controller",defaults:{kp:.2,ki:40,tsUs:10,error:1,limit:1},
      choices:[["zero-up","Ki↑ 會把 PI zero 往較高頻移"],["zero-down","Ki↑ 會把 PI zero 往較低頻移"],["none","zero 不受 Ki 影響"]],expected:"zero-up",
      evaluate:p=>{const c={...labs["pi-zero-placement"].defaults,...p},fz=c.ki/(2*pi*c.kp),stepI=c.ki*c.tsUs*1e-6*c.error,raw=c.kp*c.error+stepI;return{summary:"PI zero is set by Ki/Kp; saturation changes stored integral behavior.",metrics:{piZeroHz:fz,integralIncrementPerStep:stepI,rawOutput:raw,saturated:Math.abs(raw)>c.limit},boundary:"Position-form PI teaching calculation; exact DCL convention may differ."};}
    },
    "psfb-zvs-energy":{
      kind:"topology",defaults:{vin:400,phaseDeg:90,turnsRatio:.08,leakageH:8e-6,primaryCurrentA:2,commutationCapF:1e-9},
      choices:[["less","light load → ZVS margin 下降"],["more","light load → ZVS margin 上升"],["same","與電流無關"]],expected:"less",
      evaluate:p=>{const x=T.psfb({...labs["psfb-zvs-energy"].defaults,...p});return{summary:"Leakage/circulating energy must cover commutation capacitance energy.",metrics:{leakageEnergyuJ:x.leakageEnergyJ*1e6,commutationEnergyuJ:x.commutationEnergyJ*1e6,zvsMargin:x.zvsEnergyMargin,zvsSufficient:x.zvsEnergySufficient},boundary:"Energy sufficiency estimate only; not measured ZVS proof."};}
    },
    "llc-operating-point":{
      kind:"topology",defaults:{resonantInductanceH:20e-6,resonantCapF:100e-9,magnetizingInductanceH:120e-6,q:.5,switchingHz:180e3},
      choices:[["gain-down","遠高於 resonance 時 gain 通常下降"],["gain-up","頻率越高 gain 必然上升"],["duty","與 Buck duty 完全相同"]],expected:"gain-down",
      evaluate:p=>{const x=T.llc({...labs["llc-operating-point"].defaults,...p});return{summary:"LLC command moves on a frequency-dependent resonant gain surface.",metrics:{resonanceHz:x.resonanceHz,normalizedFrequency:x.normalizedFrequency,gain:x.gain,region:x.region,normalizedGainSlope:x.normalizedGainSlope},boundary:"FHA steady-state teaching model."};}
    },
    "llc-loop-measurement":{
      kind:"frequency",defaults:{ln:6,qA:.35,qB:.9},
      choices:[["different","不同 load/Q 應期待不同 local plant"],["same","所有 load 都同一條 loop gain"],["ignore","只需看 DC gain"]],expected:"different",
      evaluate:p=>{const c={...labs["llc-loop-measurement"].defaults,...p},freq=linspace(.65,1.8,80),a=freq.map(fn=>({fn,gain:T.llcFhaGain(fn,c.ln,c.qA)})),b=freq.map(fn=>({fn,gain:T.llcFhaGain(fn,c.ln,c.qB)}));return{summary:"LLC local plant changes with Q/load, so one global Bode curve is insufficient.",metrics:{ln:c.ln,qA:c.qA,qB:c.qB},series:{a,b},boundary:"FHA gain comparison; not an injected closed-loop SFRA measurement."};}
    },
    "epwm-signal-path":{
      kind:"timing",defaults:{periodUs:10,writeUs:10.2},
      choices:[["next","miss shadow-load → 下一個 load event 才生效"],["now","write 完立即 pin 改"],["past","回到上一個 ZERO 生效"]],expected:"next",
      evaluate:p=>{const c={...labs["epwm-signal-path"].defaults,...p},eps=1e-9,activeUs=c.writeUs<c.periodUs-eps?c.periodUs:Math.ceil((c.writeUs+eps)/c.periodUs)*c.periodUs;return{summary:"CMPA write and active PWM edge are separated by shadow-load semantics.",metrics:{periodUs:c.periodUs,writeUs:c.writeUs,activeUs,cycleDelay:Math.round(activeUs/c.periodUs)},series:[{event:"ZERO/SOCA",tUs:0},{event:"CMPA write",tUs:c.writeUs},{event:"active load",tUs:activeUs}],boundary:"Single-channel ZERO-load timing model; dead-band/sync/action qualifier not expanded here."};}
    },
    "trip-zone-authority":{
      kind:"authority",defaults:{faultUs:6,hardwareLatencyUs:.2,isrDecisionUs:14},
      choices:[["hardware","Trip hardware 可先於 ISR 強制 PWM safe"],["isr","一定要等 ISR 才能關"],["same","兩條路徑完全相同"]],expected:"hardware",
      evaluate:p=>{const c={...labs["trip-zone-authority"].defaults,...p};return{summary:"Configured hardware trip owns immediate veto; firmware owns diagnosis/restart.",metrics:{faultUs:c.faultUs,hardwareSafeUs:c.faultUs+c.hardwareLatencyUs,isrSafeUs:c.isrDecisionUs,latencyAdvantageUs:c.isrDecisionUs-(c.faultUs+c.hardwareLatencyUs)},series:[{event:"fault",tUs:c.faultUs},{event:"TZ safe",tUs:c.faultUs+c.hardwareLatencyUs},{event:"ISR-only safe",tUs:c.isrDecisionUs}],boundary:"Teaching latency comparison; real board latency requires measured evidence."};}
    },
    "dcl-controller-runtime":{
      kind:"runtime",defaults:{designedRateHz:100000,actualRateHz:50000,kp:.2,ki:40},
      choices:[["slower-i","rate 減半且 coefficient 不改，integral action/second 變慢"],["same","完全保持原動態"],["faster","integral action 變兩倍"]],expected:"slower-i",
      evaluate:p=>{const c={...labs["dcl-controller-runtime"].defaults,...p},designedTs=1/c.designedRateHz,actualTs=1/c.actualRateHz,kiStepDesigned=c.ki*designedTs,effectiveKiPerSecond=kiStepDesigned*c.actualRateHz;return{summary:"Discrete controller semantics include execution rate; coefficient intent is not rate-independent.",metrics:{designedTsUs:designedTs*1e6,actualTsUs:actualTs*1e6,designedKi:c.ki,effectiveKiPerSecond,ratio:effectiveKiPerSecond/c.ki},boundary:"Assumes Ki·Ts is precomputed for designed rate."};}
    },
    "sfra-measurement":{
      kind:"measurement",defaults:{operatingDuty:.45,injection:.02,noiseFloor:.001},
      choices:[["bad","撞 saturation 會量到非線性/失真的結果"],["better","越大 injection 永遠越準"],["none","amplitude 不影響"]],expected:"bad",
      evaluate:p=>{const c={...labs["sfra-measurement"].defaults,...p},headroom=Math.min(c.operatingDuty,1-c.operatingDuty),saturated=c.injection>=headroom,snrDb=20*Math.log10(Math.max(c.injection/c.noiseFloor,1e-12));return{summary:"SFRA needs enough amplitude for SNR but small enough to remain local/linear.",metrics:{headroomDuty:headroom,injection:c.injection,saturated,snrDb},boundary:"Amplitude/SNR teaching gate; not a substitute for measured plant repeatability."};}
    },
    "cla-ownership":{
      kind:"ownership",defaults:{producerSeq:10,consumerSeq:9,handoff:false},
      choices:[["race","沒有 handoff 可能 stale/torn/ambiguous ownership"],["safe","平行執行自然保證一致"],["speed","只會變快不會出錯"]],expected:"race",
      evaluate:p=>{const c={...labs["cla-ownership"].defaults,...p},fresh=c.handoff&&c.consumerSeq===c.producerSeq;return{summary:"Parallel execution requires explicit producer/consumer publication semantics.",metrics:{producerSeq:c.producerSeq,consumerSeq:c.consumerSeq,handoff:c.handoff,fresh,stale:!fresh},boundary:"Ownership/sequence teaching model; memory bus and CLA arbitration are device-specific."};}
    },
    "c28x-wcet-evidence":{
      kind:"timing",defaults:{deadlineUs:10,averageScale:.8},
      choices:[["no","average 變快但 max 不變，不代表 deterministic margin 增加"],["yes","average 降低就一定改善 WCET"],["ignore","max timing 不重要"]],expected:"no",
      evaluate:p=>{const c={...labs["c28x-wcet-evidence"].defaults,...p},before=[4.2,4.3,4.1,4.5,5.0,4.4,9.7,4.2],after=before.map((v,i)=>i===6?v:v*c.averageScale),avg=a=>a.reduce((x,y)=>x+y,0)/a.length,max=a=>Math.max(...a);return{summary:"WCET-oriented evidence is governed by the worst observed/proven path, not mean time.",metrics:{avgBeforeUs:avg(before),avgAfterUs:avg(after),maxBeforeUs:max(before),maxAfterUs:max(after),deadlineUs:c.deadlineUs,marginUs:c.deadlineUs-max(after)},series:{before,after},boundary:"Observed vector set is not a formal WCET proof; target/compiler/path coverage still required."};}
    }
  };

  function get(id){return labs[id]||null;}
  function list(){return Object.entries(labs).map(([id,v])=>({id,kind:v.kind,route:v.route||null}));}
  function evaluate(id,input={}){const lab=get(id);if(!lab)throw new Error("unknown TI concept lab: "+id);return lab.evaluate(input);}
  function choices(id){const lab=get(id);return lab?lab.choices:[];}
  function expected(id){const lab=get(id);return lab?.expected??null;}
  function defaults(id){return {...(get(id)?.defaults||{})};}
  return {get,list,evaluate,choices,expected,defaults};
});
