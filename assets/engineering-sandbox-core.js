(function(root){
  "use strict";
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const clone=v=>JSON.parse(JSON.stringify(v));
  function rng(seed){let a=(Number(seed)||1)>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function normalizeProfile(value,fallbackKey,fallbackValue){
    if(Array.isArray(value)&&value.length)return value.map(x=>({cycle:Math.max(0,Math.floor(finite(x.cycle,0))),[fallbackKey]:finite(x[fallbackKey],fallbackValue)})).sort((a,b)=>a.cycle-b.cycle);
    return [{cycle:0,[fallbackKey]:fallbackValue}];
  }
  function profileAt(profile,cycle,key){let v=profile[0][key];for(const p of profile){if(p.cycle>cycle)break;v=p[key];}return v;}
  function defaults(input){
    const src=Object.assign({},input||{});
    const controlPeriodUs=finite(src.controlPeriodUs,finite(src.dtUs,10));
    const cycles=Math.max(20,Math.floor(finite(src.cycles,finite(src.steps,800))));
    const vref=finite(src.vref,48),loadOhm=finite(src.loadOhm,12),loadStepOhm=finite(src.loadStepOhm,6),loadStepAt=Math.floor(finite(src.loadStepAt,300));
    const commandProfile=normalizeProfile(src.commandProfile,"vref",vref);
    const loadProfile=Array.isArray(src.loadProfile)&&src.loadProfile.length?normalizeProfile(src.loadProfile,"ohm",loadOhm):[{cycle:0,ohm:loadOhm},{cycle:Math.max(0,loadStepAt),ohm:loadStepOhm}];
    return Object.assign({
      controlPeriodUs,cycles,plantDtUs:.25,vin:80,
      commandProfile,loadProfile,
      inductanceUh:500,capacitanceUf:2200,currentLimit:12,
      kpV:.4,kiV:40,kpI:.05,kiI:800,dutyMax:.95,
      adcBits:12,currentFullScale:20,voltageFullScale:80,
      sensorGain:1,currentSensorGain:1,sensorOffset:0,currentSensorOffset:0,
      noisePct:0,edgeNoisePct:0,edgeNoiseWindowUs:.35,
      jitterUs:0,seed:17,samplePct:50,adcLatencyUs:1.2,isrLatencyUs:.8,computeUs:1.7,pwmCommitUs:.3,
      communicationMode:"safe",staleCommandCycles:0,ringSize:4,
      initialState:"RUN",precheckPassed:true,stateProgram:[],
      controlSign:1,dutyClamp:null,codeBug:null,
      tripCurrent:18,tripLatencyUs:.4
    },src,{controlPeriodUs,cycles,commandProfile,loadProfile});
  }
  function adcSample(value,fs,bits,gain,offset,noiseFraction){
    const sensed=value*gain+offset;
    const noisy=sensed*(1+noiseFraction);
    const maxCode=(1<<Math.min(24,Math.max(1,Math.floor(bits))))-1;
    const clipped=clamp(noisy,0,fs),raw=Math.round(clipped/fs*maxCode),engineering=raw/maxCode*fs;
    return{raw,engineering,sensed,noisy,clipped};
  }
  function piStep(integrator,error,kp,ki,dt,lo,hi){
    const proposed=integrator+ki*error*dt,unsat=kp*error+proposed,sat=clamp(unsat,lo,hi);
    const drivesFurtherHigh=unsat>hi&&error>0,drivesFurtherLow=unsat<lo&&error<0;
    const nextInt=(drivesFurtherHigh||drivesFurtherLow)?integrator:proposed;
    const nextUnsat=kp*error+nextInt;
    return{integrator:clamp(nextInt,lo,hi),output:clamp(nextUnsat,lo,hi),unsat:nextUnsat,saturated:nextUnsat!==clamp(nextUnsat,lo,hi)};
  }
  function stateRuntime(c){return{state:c.initialState||"RUN",precheck:!!c.precheckPassed,fault:false,rearm:false,violations:[]};}
  function applyStateAction(s,action){
    if(action==="precheck-pass"&&!s.fault){s.precheck=true;if(s.state==="OFF")s.state="PRECHECK";}
    else if(action==="ready"&&s.precheck&&!s.fault)s.state="READY";
    else if(action==="run"){if(s.state==="READY"&&s.precheck&&!s.fault)s.state="RUN";else s.violations.push("illegal-run-transition");}
    else if(action==="fault"){s.fault=true;s.rearm=false;s.state="FAULT";}
    else if(action==="fault-clear"){s.fault=false;s.state="FAULT";}
    else if(action==="rearm"){if(!s.fault&&s.state==="FAULT"){s.rearm=true;s.state="RECOVERY";}else s.violations.push("invalid-rearm");}
    else if(action==="recover"){if(s.rearm&&!s.fault){s.precheck=false;s.rearm=false;s.state="OFF";}else s.violations.push("invalid-recovery");}
    if(s.state==="RUN"&&(!s.precheck||s.fault))s.violations.push("run-invariant-broken");
  }
  function applyCodeBug(cfg){
    const c=Object.assign({},cfg),bug=c.codeBug;
    if(bug==="unit")c.sensorGain=.001;
    else if(bug==="sign")c.controlSign=-1;
    else if(bug==="stale"){c.communicationMode="stale";c.staleCommandCycles=Math.max(8,c.staleCommandCycles||0);}
    else if(bug==="shadow")c.computeUs=Math.max(c.computeUs,c.controlPeriodUs*.55);
    else if(bug==="truncation")c.sensorGain=0;
    return c;
  }
  function simulateSystem(input){
    const base=defaults(input),c=applyCodeBug(base),random=rng(c.seed),T=c.controlPeriodUs,dtPlant=Math.max(.02,Math.min(c.plantDtUs,T)),substeps=Math.max(1,Math.ceil(T/dtPlant)),dtUs=T/substeps,dt=dtUs*1e-6,L=c.inductanceUh*1e-6,C=c.capacitanceUf*1e-6;
    const state=stateRuntime(c),program=new Map();
    for(const x of c.stateProgram||[]){if(!program.has(x.cycle))program.set(x.cycle,[]);program.get(x.cycle).push(x.action);}
    let iL=0,vOut=0,vInt=0,iInt=0,appliedDuty=0,nextDuty=0,tripDueAbs=null,faultEnergy=0;
    let producerSeq=0,publishedSeq=0,completeSeq=0,consumedSeq=0,lastProducerCommand=profileAt(c.commandProfile,0,"vref"),lastCompleteCommand=lastProducerCommand;
    const commandHistory=[],trace=[],events=[],commViolations=[];
    let lastSample={rawV:0,rawI:0,measuredV:0,measuredI:0,physicalV:0,physicalI:0},missedCommits=0;
    for(let k=0;k<c.cycles;k++){
      const cycleStart=k*T;
      for(const action of program.get(k)||[])applyStateAction(state,action);
      const producerCommand=profileAt(c.commandProfile,k,"vref"),load=Math.max(.1,profileAt(c.loadProfile,k,"ohm"));
      const commandChanged=k===0||producerCommand!==lastProducerCommand;
      events.push({tUs:cycleStart,type:"PWM_ZERO",cycle:k});
      if(commandChanged){
        producerSeq++;events.push({tUs:cycleStart+.02,type:"DMA_START",cycle:k,seq:producerSeq});
        if(c.communicationMode==="early-publish"){
          publishedSeq=producerSeq;events.push({tUs:cycleStart+.04,type:"PUBLISH_EARLY",cycle:k,seq:producerSeq});commViolations.push("published-before-complete");
        }
        events.push({tUs:cycleStart+.08,type:"DMA_COMPLETE",cycle:k,seq:producerSeq});completeSeq=producerSeq;lastCompleteCommand=producerCommand;
        if(c.communicationMode!=="early-publish"){publishedSeq=producerSeq;events.push({tUs:cycleStart+.1,type:"PUBLISH",cycle:k,seq:producerSeq});}
        lastProducerCommand=producerCommand;
      }
      commandHistory.push({cycle:k,seq:producerSeq,command:producerCommand});
      let consumedCommand=producerCommand;
      if(c.communicationMode==="stale"){
        const target=Math.max(0,k-Math.max(1,Math.floor(c.staleCommandCycles||1))),old=commandHistory[target];consumedCommand=old.command;consumedSeq=old.seq;
      } else if(c.communicationMode==="early-publish"){
        consumedCommand=k===0?producerCommand:(trace[k-1]?trace[k-1].consumedCommand:lastCompleteCommand);consumedSeq=Math.max(0,completeSeq-(commandChanged?1:0));
      } else if(c.communicationMode==="wrap-bug"&&producerSeq>0&&producerSeq%c.ringSize===0){
        const old=commandHistory[Math.max(0,k-c.ringSize)];consumedCommand=old.command;consumedSeq=old.seq;commViolations.push("ring-wrap-index-corrupt");events.push({tUs:cycleStart+.12,type:"WRAP_BUG",cycle:k,seq:producerSeq});
      } else {consumedSeq=completeSeq;consumedCommand=lastCompleteCommand;}
      events.push({tUs:cycleStart+.14,type:"CONSUME",cycle:k,seq:consumedSeq});
      appliedDuty=(state.state==="RUN"&&!state.fault)?nextDuty:0;
      const sampleAt=T*c.samplePct/100,pwmEdge=appliedDuty*T;
      let sampleCaptured=false,sample=lastSample,peakIThis=iL;
      for(let s=0;s<substeps;s++){
        const t0=s*dtUs,t1=(s+1)*dtUs,abs=cycleStart+t0;
        if(tripDueAbs!==null&&abs>=tripDueAbs&&state.state!=="FAULT"){
          state.fault=true;state.state="FAULT";appliedDuty=0;events.push({tUs:tripDueAbs,type:"TRIP_ACTUATE",cycle:k});tripDueAbs=null;
        }
        const gate=state.state==="RUN"&&!state.fault&&t0<appliedDuty*T;
        const vL=gate?(c.vin-vOut):(-vOut),di=vL/L,dv=(iL-vOut/load)/C;
        iL=Math.max(0,iL+di*dt);vOut=Math.max(0,vOut+dv*dt);peakIThis=Math.max(peakIThis,iL);
        if(iL>=c.tripCurrent&&tripDueAbs===null&&state.state==="RUN"&&!state.fault){tripDueAbs=abs+c.tripLatencyUs;events.push({tUs:abs,type:"TRIP_DETECT",cycle:k});}
        if(iL>=c.tripCurrent&&state.state==="RUN"&&!state.fault)faultEnergy+=iL*iL*dt;
        if(!sampleCaptured&&t1>=sampleAt){
          const edgeDistance=Math.min(Math.abs(sampleAt),Math.abs(sampleAt-pwmEdge),Math.abs(T-sampleAt));
          const edgeFactor=edgeDistance<c.edgeNoiseWindowUs?(1-edgeDistance/Math.max(.001,c.edgeNoiseWindowUs)):0;
          const noise=((random()-.5)*2*c.noisePct/100)+((random()-.5)*2*c.edgeNoisePct/100*edgeFactor);
          const vs=adcSample(vOut,c.voltageFullScale,c.adcBits,c.sensorGain,c.sensorOffset,noise),is=adcSample(iL,c.currentFullScale,c.adcBits,c.currentSensorGain,c.currentSensorOffset,noise);
          sample={rawV:vs.raw,rawI:is.raw,measuredV:vs.engineering,measuredI:is.engineering,physicalV:vOut,physicalI:iL,edgeDistanceUs:edgeDistance,edgeNoiseFactor:edgeFactor};sampleCaptured=true;
          events.push({tUs:cycleStart+sampleAt,type:"ADC_SOC",cycle:k});events.push({tUs:cycleStart+sampleAt+c.adcLatencyUs,type:"ADC_EOC",cycle:k});
        }
      }
      lastSample=sample;
      const controlDt=T*1e-6,vErr=consumedCommand-sample.measuredV;
      let outer={integrator:vInt,output:0,unsat:0,saturated:false},inner={integrator:iInt,output:0,unsat:0,saturated:false};
      if(state.state==="RUN"&&!state.fault){
        outer=piStep(vInt,vErr,c.kpV,c.kiV,controlDt,0,c.currentLimit);vInt=outer.integrator;
        const iRef=outer.output,iErr=(iRef-sample.measuredI)*c.controlSign;
        inner=piStep(iInt,iErr,c.kpI,c.kiI,controlDt,0,c.dutyMax);iInt=inner.integrator;
      }
      let computedDuty=(state.state==="RUN"&&!state.fault)?inner.output:0;
      if(c.dutyClamp!==null&&c.dutyClamp!==undefined)computedDuty=Math.min(computedDuty,finite(c.dutyClamp,c.dutyMax));
      const jitter=(random()-.5)*2*c.jitterUs,isrAt=sampleAt+c.adcLatencyUs+c.isrLatencyUs+jitter,doneAt=isrAt+c.computeUs,commitAt=doneAt+c.pwmCommitUs,margin=T-commitAt,timingMiss=commitAt>T;
      events.push({tUs:cycleStart+isrAt,type:"ISR",cycle:k});events.push({tUs:cycleStart+doneAt,type:"CONTROL_DONE",cycle:k});events.push({tUs:cycleStart+Math.min(commitAt,T),type:timingMiss?"PWM_COMMIT_MISSED":"PWM_COMMIT",cycle:k});
      if(timingMiss){missedCommits++;nextDuty=appliedDuty;}else nextDuty=(state.state==="RUN"&&!state.fault)?computedDuty:0;
      const mode=outer.unsat>=c.currentLimit-.0001?"CC":"CV";
      trace.push({k,tUs:cycleStart,vOut,iL,peakIThis,load,producerCommand,consumedCommand,producerSeq,publishedSeq,completeSeq,consumedSeq,state:state.state,mode,computedDuty,appliedDuty,nextDuty,sampledV:sample.measuredV,sampledI:sample.measuredI,rawV:sample.rawV,rawI:sample.rawI,samplePhysicalV:sample.physicalV,samplePhysicalI:sample.physicalI,edgeDistanceUs:sample.edgeDistanceUs,timingMarginUs:margin,timingMiss,controlSaturated:inner.saturated,currentRef:outer.output});
    }
    const tail=trace.slice(Math.floor(trace.length*.8)),avgV=tail.reduce((s,x)=>s+x.vOut,0)/Math.max(1,tail.length),last=trace[trace.length-1]||{},maxSeqLag=Math.max(...trace.map(x=>Math.max(0,x.publishedSeq-x.consumedSeq)));
    return{config:c,trace,events,communication:{producerSeq,publishedSeq,completeSeq,consumedSeq,lag:Math.max(0,publishedSeq-consumedSeq),maxLag:maxSeqLag,violations:[...new Set(commViolations)]},state:{state:state.state,precheck:state.precheck,fault:state.fault,violations:[...new Set(state.violations)]},summary:{finalV:last.vOut||0,finalI:last.iL||0,avgV,voltageError:profileAt(c.commandProfile,c.cycles-1,"vref")-avgV,peakV:Math.max(...trace.map(x=>x.vOut)),peakI:Math.max(...trace.map(x=>x.peakIThis)),mode:last.mode||"CV",missedCommits,faultEnergyProxy:faultEnergy,tripSeen:events.some(x=>x.type==="TRIP_ACTUATE"),state:last.state||state.state,publishedSeq,consumedSeq,commandLag:Math.max(0,publishedSeq-consumedSeq),maxCommandLag:maxSeqLag}};
  }
  function timingWindow(input){const c=defaults(input),T=c.controlPeriodUs,soc=T*c.samplePct/100,ready=soc+c.adcLatencyUs,isr=ready+c.isrLatencyUs,done=isr+c.computeUs,commit=done+c.pwmCommitUs,margin=T-commit;return{period:T,soc,ready,isr,done,commit,margin,closed:margin>=0};}
  function simulateConverter(input){const x=Object.assign({},input||{});if(x.dtUs!==undefined&&x.controlPeriodUs===undefined)x.controlPeriodUs=x.dtUs;if(x.steps!==undefined&&x.cycles===undefined)x.cycles=x.steps;return simulateSystem(x);}
  function dmaScenario(input){const x=Object.assign({controlPeriodUs:10,cycles:220,commandProfile:[{cycle:0,vref:24},{cycle:40,vref:48},{cycle:120,vref:36}],loadProfile:[{cycle:0,ohm:12}],communicationMode:"safe",staleCommandCycles:20},input||{});if(x.mode){x.communicationMode=x.mode==="early-publish"?"early-publish":x.mode==="wrap-bug"?"wrap-bug":"safe";}const r=simulateSystem(x);return{config:r.config,events:r.events.filter(e=>/DMA|PUBLISH|CONSUME|WRAP/.test(e.type)),published:r.communication.publishedSeq,consumed:r.communication.consumedSeq,dropped:r.communication.violations.includes("ring-wrap-index-corrupt")?1:0,violations:r.communication.violations,pass:r.communication.violations.length===0,finalV:r.summary.finalV,commandLag:r.summary.commandLag,system:r};}
  const STATE_ORDER=["OFF","PRECHECK","READY","RUN","FAULT","RECOVERY"];
  function runStateMachine(actions){const s={state:"OFF",precheck:false,fault:false,rearm:false,violations:[]},log=[];for(const action of actions||[]){applyStateAction(s,action);log.push({action,state:s.state,precheck:s.precheck,fault:s.fault,rearm:s.rearm,pwm:s.state==="RUN"&&!s.fault});}return{state:s.state,precheck:s.precheck,fault:s.fault,rearm:s.rearm,log,violations:[...new Set(s.violations)],pass:s.violations.length===0,stateOrder:STATE_ORDER.slice()};}
  const FAULT_PRESETS={
    sensorGain:c=>{c.sensorGain=.9;},
    staleCommand:c=>{c.communicationMode="stale";c.staleCommandCycles=25;},
    controlSign:c=>{c.controlSign=-1;},
    dutyClamp:c=>{c.dutyClamp=.28;},
    missedCommit:c=>{c.computeUs=4.2;c.jitterUs=1.4;c.samplePct=50;}
  };
  function multiFault(seed){const keys=Object.keys(FAULT_PRESETS),r=rng(seed||23),a=Math.floor(r()*keys.length),b=(a+1+Math.floor(r()*(keys.length-1)))%keys.length,faults=[keys[a],keys[b]];const config=defaults({cycles:700,seed:seed||23,commandProfile:[{cycle:0,vref:24},{cycle:120,vref:48},{cycle:420,vref:36}],loadProfile:[{cycle:0,ohm:12},{cycle:300,ohm:6}],edgeNoisePct:0});for(const f of faults)FAULT_PRESETS[f](config);const system=simulateSystem(config);return{faults,config,system};}
  function measureSystem(result,measurement){const r=result.system||result,t=r.trace||[],last=t[t.length-1]||{};if(measurement==="dmm")return{measurement,value:{vout:Number(r.summary.avgV.toFixed(3)),iout:Number((r.summary.avgV/Math.max(.1,last.load||12)).toFixed(3))},text:`DMM: Vout ${r.summary.avgV.toFixed(2)} V`};if(measurement==="raw")return{measurement,value:{rawV:last.rawV,rawI:last.rawI,physicalV:last.samplePhysicalV},text:`Raw ADC: V=${last.rawV} counts, sample physical ${last.samplePhysicalV.toFixed(2)} V`};if(measurement==="scaled")return{measurement,value:{measuredV:last.sampledV,measuredI:last.sampledI},text:`Scaled: ${last.sampledV.toFixed(2)} V / ${last.sampledI.toFixed(2)} A`};if(measurement==="duty")return{measurement,value:{computed:last.computedDuty,applied:last.appliedDuty,misses:r.summary.missedCommits},text:`Duty: computed ${(last.computedDuty*100).toFixed(1)}%, applied ${(last.appliedDuty*100).toFixed(1)}%, misses ${r.summary.missedCommits}`};if(measurement==="seq")return{measurement,value:{published:r.communication.publishedSeq,consumed:r.communication.consumedSeq,lag:r.communication.lag,maxLag:r.communication.maxLag,violations:r.communication.violations},text:`Sequence: final lag ${r.communication.lag}, max lag ${r.communication.maxLag}`};if(measurement==="timing"){const min=Math.min(...t.map(x=>x.timingMarginUs));return{measurement,value:{minMarginUs:min,misses:r.summary.missedCommits},text:`Timing: min margin ${min.toFixed(2)} µs, missed ${r.summary.missedCommits}`};}if(measurement==="state")return{measurement,value:r.state,text:`State: ${r.state.state}, fault=${r.state.fault}`};return{measurement,value:null,text:"No measurement"};}
  function diagnosticScore(faults,measurements,guess){const unique=[...new Set(measurements||[])],g=[...new Set(guess||[])],correct=g.filter(x=>(faults||[]).includes(x)).length,falsePos=g.filter(x=>!(faults||[]).includes(x)).length,accuracy=correct/Math.max(1,(faults||[]).length),efficiency=Math.max(0,1-Math.max(0,unique.length-3)*.15),score=Math.round(100*clamp(accuracy*.75+efficiency*.25-falsePos*.15,0,1));return{score,accuracy,measurementCost:unique.length,falsePos,pass:accuracy===1&&falsePos===0&&unique.length<=5};}
  const CODE_BUGS={
    unit:{line:"current = raw * gain; // gain is mA/count but code treats it as A",effect:"current/voltage feedback scale becomes wrong, so the controller drives the plant to the wrong physical point",measurement:"compare raw ADC → scaled engineering unit → independent DMM",preset:"unit"},
    sign:{line:"error = measured - reference;",effect:"negative feedback becomes positive feedback; duty moves the wrong way",measurement:"step the reference and compare error sign with duty direction",preset:"sign"},
    stale:{line:"control(command_buffer[consumer_index]); // index not advanced after publish",effect:"the controller follows an older command even though the producer published a new one",measurement:"compare producer / published / consumed sequence numbers",preset:"stale"},
    shadow:{line:"write_pwm(duty); // write finishes after the shadow-load deadline",effect:"computed duty misses the load point, so the old duty stays for another cycle",measurement:"put CONTROL_DONE and PWM_COMMIT on the same timeline",preset:"shadow"},
    truncation:{line:"uint16_t gain = 3/5;",effect:"integer truncation collapses the scale to zero, so feedback becomes physically wrong",measurement:"inspect runtime gain and compare scaled value with the DMM",preset:"truncation"}
  };
  function codeTrace(bug){const key=bug in CODE_BUGS?bug:"unit",meta=CODE_BUGS[key],config=defaults({cycles:650,seed:31,commandProfile:[{cycle:0,vref:24},{cycle:120,vref:48}],loadProfile:[{cycle:0,ohm:12}],codeBug:key});const system=simulateSystem(config);return{bug:key,...meta,system,measurement:measureSystem(system,key==="stale"?"seq":key==="shadow"?"timing":key==="unit"||key==="truncation"?"scaled":"duty")};}
  const api={version:"3.0.0",defaults,simulateSystem,simulateConverter,timingWindow,dmaScenario,runStateMachine,multiFault,measureSystem,diagnosticScore,codeTrace,CODE_BUGS,FAULT_PRESETS};
  root.CircuitEngineeringSandboxCore=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
