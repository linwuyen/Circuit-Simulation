(function(root,factory){
  root.CircuitTIDiagnosticWorkbench=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const COVERAGE=Object.freeze([
    ["ADC scaling","repair kernel: sensorGain"],
    ["probe ratio","measurement contract / sensing view"],
    ["aliasing","sensing + timing diagnosis"],
    ["ISR late","repair kernel: missedCommit"],
    ["PWM polarity / shadow load","timing + command-vs-pin contract"],
    ["saturation","digital control workbench"],
    ["PI windup","digital control anti-windup"],
    ["wrong operating model","Buck CCM/BCM/DCM workbench"],
    ["RHPZ bandwidth","Boost constraint atlas"],
    ["ZVS loss","PSFB constraint atlas"],
    ["LLC region error","LLC constraint atlas"],
    ["trip configuration","PWM authority / Trip Zone workbench"]
  ]);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  function mount({host,seed=23,onSnapshot=null}={}){
    if(!host)throw new Error("diagnostic host required");
    const Training=root.CircuitRepairTraining;
    if(!Training){host.replaceChildren(el("p","ti-diagnostic-error","Repair training core missing."));return{destroy(){}};}
    host.hidden=false;host.replaceChildren();

    const shell=el("div","ti-diagnostic-workbench");
    const head=el("div","ti-diagnostic-head");
    head.append(el("strong",null,"UNKNOWN SYSTEM · MULTI-FAULT REPAIR"),el("span",null,"measure → diagnose → repair → transfer verify"));

    const seedRow=el("div","ti-diagnostic-seed"),seedInput=el("input"),newCase=el("button",null,"Load hidden machine"),reveal=el("button",null,"Reveal answer → practice only");
    seedInput.type="number";seedInput.min=1;seedInput.max=1000000;seedInput.value=seed;seedInput.dataset.diagnostic="seed";
    newCase.type=reveal.type="button";seedRow.append(el("span",null,"Seed"),seedInput,newCase,reveal);

    const symptom=el("p","ti-diagnostic-symptom");
    const measurements=el("section","ti-diagnostic-measurements");
    measurements.append(el("strong",null,"1. Measurement budget ≤ 5"));
    const measurementButtons=el("div");measurements.append(measurementButtons);
    const log=el("ol","ti-diagnostic-log");measurements.append(log);

    const diagnosis=el("section","ti-diagnostic-diagnosis");
    diagnosis.append(el("strong",null,"2. Commit two root causes + at least two measured evidence items"));
    const guessBox=el("div","ti-diagnostic-guesses"),evidenceBox=el("div","ti-diagnostic-evidence");
    const submit=el("button",null,"Lock first diagnosis");submit.type="button";submit.dataset.diagnostic="submit";
    diagnosis.append(guessBox,evidenceBox,submit);

    const repair=el("section","ti-diagnostic-repair");
    repair.append(el("strong",null,"3. Repair machine → verify nominal + changed condition"));
    const repairButtons=el("div"),verify=el("button",null,"Verify nominal + transfer");verify.type="button";verify.dataset.diagnostic="verify";
    repair.append(repairButtons,verify);

    const verdict=el("div","ti-diagnostic-verdict");
    const coverage=el("details","ti-diagnostic-coverage"),summary=el("summary",null,"Fault-family coverage map");
    const table=el("table"),tbody=el("tbody");
    COVERAGE.forEach(([family,owner])=>{const tr=el("tr");tr.append(el("td",null,family),el("td",null,owner));tbody.append(tr);});
    table.append(tbody);coverage.append(summary,table);
    const boundary=el("p","ti-diagnostic-boundary","Evidence boundary: this hidden repair kernel has two injected faults from its own five-fault system model. The wider fault-family map points to separate executable workbenches with different model fidelity. Practice verification is not an independent oracle and is not board evidence.");

    shell.append(head,seedRow,symptom,measurements,diagnosis,repair,verdict,coverage,boundary);host.append(shell);

    let session=null;

    function emit(){
      if(typeof onSnapshot!=="function"||!session)return;
      const v=session.view();
      onSnapshot({
        seed:v.seed,phase:v.phase,measurementCost:v.measurementCost,
        diagnosisCommitted:v.diagnosisCommitted,repairs:v.repairs,
        result:v.result?{
          passed:v.result.passed,physicalPass:v.result.physicalPass,
          firstJudgmentCorrect:v.result.firstJudgmentCorrect,
          score:v.result.score,evidenceCeiling:v.result.evidenceCeiling,
          independentOracle:v.result.independentOracle,
          transfer:v.result.transfer
        }:null
      });
    }

    function setStatus(message,kind=""){
      verdict.textContent=message;verdict.dataset.status=kind;
    }

    function render(){
      const v=session.view();
      symptom.textContent=v.symptom+" · seed "+v.seed;
      log.replaceChildren();
      v.measurements.forEach(m=>{
        const li=el("li");li.append(el("b",null,Training.MEASUREMENTS[m.id]+": "),document.createTextNode(JSON.stringify(m)));log.append(li);
      });
      measurementButtons.replaceChildren();
      for(const[id,label]of Object.entries(Training.MEASUREMENTS)){
        const b=el("button",null,label);b.type="button";b.dataset.measure=id;
        b.disabled=v.diagnosisCommitted||v.measurements.some(m=>m.id===id)||v.measurements.length>=5;
        b.onclick=()=>{try{session.measure(id);render();emit();}catch(error){setStatus(error.message,"error");}};measurementButtons.append(b);
      }

      guessBox.replaceChildren();
      for(const[id,label]of Object.entries(Training.FAULTS)){
        const l=el("label"),input=el("input");input.type="checkbox";input.value=id;input.name="ti-diagnostic-guess";input.disabled=v.diagnosisCommitted;
        if(v.diagnosis?.guesses?.includes(id))input.checked=true;
        l.append(input,document.createTextNode(" "+label));guessBox.append(l);
      }
      evidenceBox.replaceChildren(el("span",null,"Evidence:"));
      for(const m of v.measurements){
        const l=el("label"),input=el("input");input.type="checkbox";input.value=m.id;input.name="ti-diagnostic-evidence";input.disabled=v.diagnosisCommitted;
        if(v.diagnosis?.evidenceIds?.includes(m.id))input.checked=true;
        l.append(input,document.createTextNode(" "+Training.MEASUREMENTS[m.id]));evidenceBox.append(l);
      }
      submit.disabled=v.diagnosisCommitted;

      repairButtons.replaceChildren();
      for(const[id,label]of Object.entries(Training.FAULTS)){
        const b=el("button",null,label);b.type="button";b.dataset.repair=id;
        b.disabled=!v.diagnosisCommitted||v.repairs.includes(id)||v.result?.passed;
        b.onclick=()=>{try{session.repair(id);render();emit();}catch(error){setStatus(error.message,"error");}};repairButtons.append(b);
      }
      verify.disabled=!v.diagnosisCommitted||v.repairs.length===0||v.result?.passed;
      if(v.result){
        setStatus(
          (v.result.passed?"PRACTICE PASS":"NOT YET")+" · physical "+(v.result.physicalPass?"PASS":"FAIL")+
          " · first diagnosis "+(v.result.firstJudgmentCorrect?"correct":"wrong")+
          " · transfer "+(Object.values(v.result.transfer||{}).every(Boolean)?"PASS":"FAIL")+
          " · evidence ceiling "+v.result.evidenceCeiling,
          v.result.passed?"pass":"fail"
        );
      }else if(v.revealed)setStatus("Answer revealed: this case is practice-only and cannot become an independent first-pass claim.","practice");
      else setStatus(v.measurementCost+"/5 measurements used · phase "+v.phase,"");
    }

    function load(){
      try{session=Training.create(Number(seedInput.value));render();emit();}
      catch(error){setStatus(error.message,"error");}
    }
    newCase.onclick=load;
    reveal.onclick=()=>{const r=session.reveal();setStatus("Answer: "+r.answer.join(" + ")+" · practice only","practice");render();emit();};
    submit.onclick=()=>{
      try{
        const guesses=[...guessBox.querySelectorAll('input:checked')].map(x=>x.value);
        const evidence=[...evidenceBox.querySelectorAll('input:checked')].map(x=>x.value);
        session.submit(guesses,evidence);render();emit();
      }catch(error){setStatus(error.message,"error");}
    };
    verify.onclick=()=>{try{session.verify();render();emit();}catch(error){setStatus(error.message,"error");}};
    load();
    return{destroy(){host.replaceChildren();},getSession:()=>session};
  }
  return Object.freeze({COVERAGE,mount});
});
