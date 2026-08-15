(function(root){
  "use strict";
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  function rng(seed){let a=(Number(seed)||1)>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function defaults(cfg){return Object.assign({
    dtUs:10,steps:800,vin:80,vref:48,loadOhm:12,loadStepOhm:6,loadStepAt:300,
    inductanceUh:500,capacitanceUf:2200,currentLimit:12,
    kpV:.4,kiV:40,kpI:.05,kiI:800,dutyMax:.95,
    adcBits:12,currentFullScale:20,voltageFullScale:80,
    sensorGain:1,sensorOffset:0,noisePct:0,jitterUs:0,seed:17,
    staleCommandCycles:0,missedCommitEvery:0,controlSign:1,dutyClamp:null,
    samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:1.7,pwmCommitUs:.3,
    tripCurrent:18,tripLatencyUs:.4
  },cfg||{});}
  function quantize(v,fs,bits){const max=(1<<Math.min(24,Math.max(1,bits)))-1;return clamp(Math.round(clamp(v,0,fs)/fs*max),0,max)/max*fs;}
  function simulateConverter(input){
    const c=defaults(input),dt=c.dtUs*1e-6,L=c.inductanceUh*1e-6,C=c.capacitanceUf*1e-6,random=rng(c.seed);
    let iL=0,vOut=0,vInt=0,iInt=0,prevIErr=0,duty=0,appliedDuty=0,latchedDuty=0;
    const commandHistory=[],trace=[],events=[];
    const periodUs=c.dtUs;
    for(let k=0;k<c.steps;k++){
      const tUs=k*c.dtUs,load=k>=c.loadStepAt?c.loadStepOhm:c.loadOhm;
      commandHistory.push(c.vref);
      const delayedIndex=Math.max(0,commandHistory.length-1-Math.max(0,Math.floor(c.staleCommandCycles)));
      const command=commandHistory[delayedIndex];
      const noise=(random()-.5)*2*c.noisePct/100;
      const sensedV=quantize((vOut*c.sensorGain+c.sensorOffset)*(1+noise),c.voltageFullScale,c.adcBits);
      const sensedI=quantize(Math.max(0,iL*(1+noise)),c.currentFullScale,c.adcBits);
      const vErr=command-sensedV;
      vInt=clamp(vInt+c.kiV*vErr*dt,0,c.currentLimit);
      const cvRef=clamp(c.kpV*vErr+vInt,0,c.currentLimit);
      const iRef=Math.min(c.currentLimit,cvRef);
      const iErr=(iRef-sensedI)*c.controlSign;
      iInt=clamp(iInt+c.kiI*iErr*dt,0,c.dutyMax);
      duty=clamp(c.kpI*iErr+iInt,0,c.dutyMax);
      if(c.dutyClamp!==null&&c.dutyClamp!==undefined)duty=Math.min(duty,finite(c.dutyClamp,c.dutyMax));
      const missed=c.missedCommitEvery>0&&k>0&&k%c.missedCommitEvery===0;
      if(!missed){latchedDuty=duty;appliedDuty=latchedDuty;}
      const overCurrent=iL>=c.tripCurrent;
      if(overCurrent)appliedDuty=0;
      const di=(appliedDuty*c.vin-vOut)/L;
      const dv=(iL-vOut/Math.max(.1,load))/C;
      iL=Math.max(0,iL+di*dt);vOut=Math.max(0,vOut+dv*dt);
      const mode=cvRef>=c.currentLimit-.001?"CC":"CV";
      trace.push({k,tUs,vOut,iL,duty,appliedDuty,iRef,sensedV,sensedI,mode,load,missed,overCurrent});
      const jitter=(random()-.5)*2*c.jitterUs;
      const base=tUs;
      events.push({tUs:base,type:"PWM_ZERO",cycle:k});
      events.push({tUs:base+periodUs*c.samplePct/100,type:"ADC_SOC",cycle:k});
      events.push({tUs:base+periodUs*c.samplePct/100+c.adcLatencyUs,type:"ADC_EOC",cycle:k});
      events.push({tUs:base+periodUs*c.samplePct/100+c.adcLatencyUs+c.isrLatencyUs+jitter,type:"ISR",cycle:k});
      events.push({tUs:base+periodUs*c.samplePct/100+c.adcLatencyUs+c.isrLatencyUs+c.computeUs+jitter,type:"CONTROL_DONE",cycle:k});
      events.push({tUs:base+periodUs*c.samplePct/100+c.adcLatencyUs+c.isrLatencyUs+c.computeUs+c.pwmCommitUs+jitter,type:missed?"PWM_COMMIT_MISSED":"PWM_COMMIT",cycle:k});
      if(overCurrent)events.push({tUs:base+c.tripLatencyUs,type:"TRIP",cycle:k});
    }
    const last=trace[trace.length-1]||{},peakV=Math.max(...trace.map(x=>x.vOut)),peakI=Math.max(...trace.map(x=>x.iL));
    const settleStart=Math.floor(trace.length*.8),tail=trace.slice(settleStart),avgV=tail.reduce((s,x)=>s+x.vOut,0)/Math.max(1,tail.length);
    return {config:c,trace,events,summary:{finalV:last.vOut||0,finalI:last.iL||0,peakV,peakI,avgV,mode:last.mode||"CV",voltageError:c.vref-avgV,tripSeen:trace.some(x=>x.overCurrent),missedCommits:trace.filter(x=>x.missed).length}};
  }
  function timingWindow(cfg){const c=defaults(cfg),period=c.dtUs,soc=period*c.samplePct/100,ready=soc+c.adcLatencyUs,isr=ready+c.isrLatencyUs,done=isr+c.computeUs,commit=done+c.pwmCommitUs,margin=period-commit;return{period,soc,ready,isr,done,commit,margin,closed:margin>=0};}
  function dmaScenario(input){
    const c=Object.assign({ringSize:4,bursts:8,consumerEvery:1,mode:"safe"},input||{}),ring=Array(c.ringSize).fill(null),events=[],violations=[];
    let write=0,read=0,published=0,consumed=0,dropped=0;
    for(let seq=1;seq<=c.bursts;seq++){
      const slot=write%c.ringSize;
      events.push({step:events.length,type:"DMA_START",seq,slot});
      if(c.mode==="early-publish"){published=seq;events.push({step:events.length,type:"PUBLISH",seq,slot,complete:false});violations.push("published-before-complete");}
      if(ring[slot]!==null&&ring[slot].seq>consumed){dropped++;violations.push("overwrite-unconsumed");}
      ring[slot]={seq,complete:true};events.push({step:events.length,type:"DMA_COMPLETE",seq,slot});
      if(c.mode!=="early-publish"){published=seq;events.push({step:events.length,type:"PUBLISH",seq,slot,complete:true});}
      write=(write+1)%c.ringSize;
      const shouldConsume=c.consumerEvery>0&&seq%c.consumerEvery===0;
      if(shouldConsume){
        const rslot=read%c.ringSize,item=ring[rslot];
        if(item&&item.complete&&item.seq<=published){consumed=item.seq;ring[rslot]=null;events.push({step:events.length,type:"CONSUME",seq:item.seq,slot:rslot});read=(read+1)%c.ringSize;}
        else {violations.push("consumer-read-invalid");events.push({step:events.length,type:"CONSUME_BLOCKED",slot:rslot});}
      }
      if(c.mode==="wrap-bug"&&write===0){write=1;violations.push("ring-wrap-index-corrupt");events.push({step:events.length,type:"WRAP_BUG"});}
    }
    return{config:c,events,published,consumed,dropped,violations:[...new Set(violations)],pass:violations.length===0};
  }
  const STATE_ORDER=["OFF","PRECHECK","READY","RUN","FAULT","RECOVERY"];
  function runStateMachine(actions){
    let state="OFF",precheck=false,fault=false,rearm=false;const log=[],violations=[];
    const snap=(action)=>log.push({action,state,precheck,fault,rearm,pwm:state==="RUN"&&!fault});
    for(const action of actions||[]){
      if(action==="precheck-pass"&&!fault){precheck=true;if(state==="OFF")state="PRECHECK";}
      else if(action==="ready"&&precheck&&!fault)state="READY";
      else if(action==="run"){if(state==="READY"&&precheck&&!fault)state="RUN";else violations.push("illegal-run-transition");}
      else if(action==="fault"){fault=true;rearm=false;state="FAULT";}
      else if(action==="fault-clear"){fault=false;state="FAULT";}
      else if(action==="rearm"){if(!fault&&state==="FAULT"){rearm=true;state="RECOVERY";}else violations.push("invalid-rearm");}
      else if(action==="recover"){if(rearm&&!fault){precheck=false;rearm=false;state="OFF";}else violations.push("invalid-recovery");}
      snap(action);
      if(state==="RUN"&&(!precheck||fault))violations.push("run-invariant-broken");
    }
    return{state,log,violations:[...new Set(violations)],pass:violations.length===0,stateOrder:STATE_ORDER.slice()};
  }
  const FAULTS={
    sensorGain:{label:"sensor gain -10%",measure:{dmm:"physical output nominal",raw:"raw ADC follows sensor voltage",scaled:"scaled value is -10%",duty:"duty elevated",seq:"sequence nominal",timing:"timing nominal"}},
    staleCommand:{label:"stale command",measure:{dmm:"output follows an older command",raw:"raw ADC self-consistent",scaled:"scale nominal",duty:"duty matches old command",seq:"consumed sequence lags published",timing:"timing nominal"}},
    controlSign:{label:"control sign error",measure:{dmm:"output diverges from command",raw:"sensing nominal",scaled:"scale nominal",duty:"duty moves opposite error",seq:"sequence nominal",timing:"timing nominal"}},
    dutyClamp:{label:"duty clamp",measure:{dmm:"output saturates low",raw:"sensing nominal",scaled:"scale nominal",duty:"duty pinned at clamp",seq:"sequence nominal",timing:"timing nominal"}},
    missedCommit:{label:"missed PWM commit",measure:{dmm:"intermittent one-cycle lag",raw:"sensing nominal",scaled:"scale nominal",duty:"computed duty differs from applied duty",seq:"sequence nominal",timing:"commit crosses load deadline"}}
  };
  function multiFault(seed){const keys=Object.keys(FAULTS),r=rng(seed||23),a=Math.floor(r()*keys.length),b=(a+1+Math.floor(r()*(keys.length-1)))%keys.length,faults=[keys[a],keys[b]];return{faults,labels:faults.map(x=>FAULTS[x].label)};}
  function measureFaults(faults,measurement){const vals=(faults||[]).map(f=>FAULTS[f]&&FAULTS[f].measure[measurement]).filter(Boolean);return vals.length?vals.join(" + "):"no discriminating evidence";}
  function diagnosticScore(faults,measurements,guess){const unique=[...new Set(measurements||[])],correct=[...new Set(guess||[])].filter(x=>(faults||[]).includes(x)).length,falsePos=[...new Set(guess||[])].filter(x=>!(faults||[]).includes(x)).length;const accuracy=correct/Math.max(1,(faults||[]).length),efficiency=Math.max(0,1-Math.max(0,unique.length-3)*.15),score=Math.round(100*clamp(accuracy*.75+efficiency*.25-falsePos*.15,0,1));return{score,accuracy,measurementCost:unique.length,falsePos,pass:accuracy===1&&falsePos===0&&unique.length<=5};}
  const CODE_BUGS={
    unit:{line:"current = raw * gain; // gain uses mA/count but current is treated as A",effect:"controller sees a 1000× current scale error",measurement:"compare raw ADC → engineering unit → independent current reference"},
    sign:{line:"error = measured - reference;",effect:"negative feedback becomes positive feedback",measurement:"step reference and compare error sign against duty direction"},
    stale:{line:"control(command_buffer[consumer_index]); // index not advanced after publish",effect:"control consumes an older command",measurement:"trace producer/published/consumed sequence numbers"},
    shadow:{line:"write_pwm(duty); // write occurs after shadow load event",effect:"computed duty applies one PWM period late",measurement:"align CONTROL_DONE and PWM_LOAD on the same timeline"},
    truncation:{line:"uint16_t gain = 3/5;",effect:"integer truncation collapses the intended gain",measurement:"inspect numeric type and compare expected scaled value against runtime value"}
  };
  function codeTrace(bug){const b=CODE_BUGS[bug]||CODE_BUGS.unit;return{bug:bug in CODE_BUGS?bug:"unit",...b};}
  const api={version:"2.0.0",defaults,simulateConverter,timingWindow,dmaScenario,runStateMachine,multiFault,measureFaults,diagnosticScore,codeTrace,FAULTS,CODE_BUGS};
  root.CircuitEngineeringSandboxCore=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
