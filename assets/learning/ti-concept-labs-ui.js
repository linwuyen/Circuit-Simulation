(function(root,factory){
  root.CircuitTIConceptLabs=factory(root);
})(globalThis,function(root){
  "use strict";
  const $=id=>document.getElementById(id);
  const E=root.CircuitEvidence;
  const Core=root.CircuitTIConceptLabCore;
  const Policy=root.CircuitTILearningCore;
  let cards=[],labs=[],manifest=null,current=null,lab=null;

  const adapterRoutes={
    "buck-first-cycle":"#ti-learning",
    "topology-boost":"17_power_topology_control/",
    "source-evidence":null,
    "acmc":"10.acmc-pro_power_simulator/",
    "control-bode":"#ti-control",
    "pi-runtime":"#ti-control",
    "topology-psfb":"17_power_topology_control/",
    "topology-llc":"17_power_topology_control/",
    "sfra":"19_c2000_buck_firmware_lab/",
    "c2000-timing":"#ti-timing",
    "protection":"14_power_protection/",
    "dcl":"19_c2000_buck_firmware_lab/",
    "wcet":"6.10μs 高頻控制迴路模擬器/"
  };

  function today(){return Policy.isoDayLocal(new Date());}
  function parseId(){
    const raw=decodeURIComponent(location.hash.replace(/^#ti-concepts\/?/,""));
    return cards.some(c=>c.id===raw)?raw:null;
  }
  function state(){return E.load();}
  function record(id=current.id){return state().benchmark?.tiConceptLabs?.[id]||{};}
  function save(id,value){
    const s=state();s.benchmark.tiConceptLabs||={};s.benchmark.tiConceptLabs[id]=value;E.save(s);return value;
  }
  async function loadData(){
    const [c,l,m]=await Promise.all([
      fetch("learning/ti/concept-cards.json",{cache:"no-store"}).then(r=>r.json()),
      fetch("learning/ti/concept-labs.json",{cache:"no-store"}).then(r=>r.json()),
      fetch("learning/ti/manifest.json",{cache:"no-store"}).then(r=>r.json())
    ]);
    const check=Core.validate(c,l);if(!check.valid)throw Error("TI concept lab closure invalid: "+check.errors.join("; "));
    cards=c.cards;labs=l.labs;manifest=m;
    const id=parseId()||chooseDefault();
    select(id,false);
  }
  function chooseDefault(){
    const s=state(),day=today();
    const due=cards.find(card=>{
      const r=s.benchmark?.tiConceptLabs?.[card.id];
      return r?.nextReview&&r.nextReview<=day&&Core.prerequisiteStatus(card,s).unlocked;
    });
    if(due)return due.id;
    const open=cards.find(card=>Core.prerequisiteStatus(card,s).unlocked && !s.benchmark?.tiConceptLabs?.[card.id]?.completed);
    return (open||cards[0]).id;
  }
  function select(id,navigate=true){
    current=cards.find(c=>c.id===id)||cards[0];
    lab=labs.find(l=>l.id===current.id);
    if(navigate)history.replaceState(null,"","#ti-concepts/"+encodeURIComponent(current.id));
    render();
  }
  function setupChrome(){
    document.body.dataset.tiConceptLabs="true";
    document.querySelector(".route")?.setAttribute("hidden","");
    ["setup-panel","free-controls","concept-note","transfer-preview","workbench-context-slot","lesson-control"].forEach(id=>{const n=$(id);if(n)n.hidden=true;});
    $("circuit").hidden=true;$("circuit-state").hidden=true;
    document.querySelector(".metrics").hidden=false;
    $("ws-display-wrap").hidden=false;
    const header=document.querySelector(".workspace-header strong");if(header)header.textContent="TI Concept Labs · 15/15";
    const entry=$("open-ti-learning");if(entry){entry.textContent="返回 TI Learning";entry.onclick=()=>{location.hash="ti-learning";location.reload();};}
    $("workspace-progress").textContent="Predict → Diagnose → Transfer → spaced review";
    $("deeper").hidden=true;$("explore").hidden=true;$("back-to-lesson").hidden=true;$("ws-hint").hidden=true;$("ws-explanation").hidden=true;
  }
  function nav(){
    let box=$("ti-concept-nav");
    if(!box){box=document.createElement("div");box.id="ti-concept-nav";box.className="ti-concept-nav";$("surface-title").after(box);}
    box.replaceChildren();
    const s=state();
    cards.forEach((card,index)=>{
      const ps=Core.prerequisiteStatus(card,s),r=s.benchmark?.tiConceptLabs?.[card.id];
      const b=document.createElement("button");b.type="button";b.disabled=!ps.unlocked;b.className=card.id===current.id?"is-active":"";
      const mark=r?.completed?"✓":r?.nextReview&&r.nextReview<=today()?"↻":String(index+1);
      b.textContent=`${mark} ${card.title}`;
      if(!ps.unlocked)b.title="Requires: "+ps.missing.join(", ");
      b.onclick=()=>select(card.id);
      box.append(b);
    });
  }
  function sourceDocs(){
    return current.sourceIds.map(id=>manifest.documents.find(d=>d.id===id)).filter(Boolean);
  }
  function surface(){
    $("surface-title").textContent=current.title;
    const r=record(),session=Core.normalize(r).session,ps=Core.prerequisiteStatus(current,state());
    $("ws-voltage").textContent=ps.unlocked?(r.grade||"NEW").toUpperCase():"LOCK";
    $("ws-current").textContent=`${Object.values(session.attempts||{}).filter(x=>x.passed).length}/3`;
    $("ws-display").textContent=r.nextReview||"—";
    const labels=[["ws-voltage","Grade"],["ws-current","Stages"],["ws-display","Next review"]];
    labels.forEach(([id,label])=>{const n=$(id);if(n?.parentElement&&n.parentElement.firstChild)n.parentElement.firstChild.nodeValue=label;});

    let board=$("ti-concept-board");
    if(!board){board=document.createElement("div");board.id="ti-concept-board";board.className="ti-concept-board";$("ws-plot").before(board);}
    board.replaceChildren();
    const fields=[
      ["PHYSICS",current.model.physics],
      ["MATH",(current.model.math||[]).length?current.model.math.join(" · "):"No single equation is sufficient; use the causal/timing contract."],
      ["IMPLEMENTATION",current.model.implementation],
      ["EVIDENCE",current.model.evidence]
    ];
    fields.forEach(([title,text])=>{
      const card=document.createElement("section");card.className="ti-concept-card";
      const h=document.createElement("strong");h.textContent=title;const p=document.createElement("p");p.textContent=text;card.append(h,p);board.append(card);
    });

    const plot=$("ws-plot");plot.hidden=false;plot.replaceChildren();plot.setAttribute("viewBox","0 0 720 180");
    const steps=["Physics","Model","Implementation","Evidence"];
    steps.forEach((x,i)=>{
      const px=80+i*180;
      plot.append(svg("rect",{x:px,y:55,width:120,height:48,rx:10,class:"ti-concept-node"}));
      plot.append(svg("text",{x:px+60,y:84,"text-anchor":"middle",class:"ti-concept-node-text"},x));
      if(i<steps.length-1){plot.append(svg("path",{d:`M${px+120} 79H${px+172}`,class:"ti-concept-arrow"}));}
    });
    $("ws-comparison").textContent=lab.adapter==="source-evidence"
      ?"Evidence surface only — no fake executable simulator is claimed."
      : `Executable/reference adapter available: ${lab.adapter}`;

    const help=$("surface-help");help.replaceChildren();
    const src=document.createElement("div");src.className="ti-concept-sources";
    sourceDocs().forEach(d=>{const a=document.createElement("a");a.href=d.url;a.target="_blank";a.rel="noopener";a.textContent=d.id;src.append(a);});
    current.projectLinks.forEach(link=>{const a=document.createElement("a");a.href=link.endsWith("/")?link:link+"/";a.textContent="Project: "+link;src.append(a);});
    const route=adapterRoutes[lab.adapter];
    if(route){
      const a=document.createElement("a");a.className="ti-adapter-link";a.textContent="Open executable/reference surface";
      if(route.startsWith("#")){a.href=route;a.onclick=e=>{e.preventDefault();location.hash=route.slice(1);location.reload();};}
      else a.href=route;
      src.append(a);
    }
    help.append(src);
    $("scope-note").textContent="Source claims come from the listed TI documents. The evidence panel does not upgrade MODEL/SOURCE evidence into hardware evidence.";
  }
  function svg(tag,attrs={},text=""){
    const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text)n.textContent=text;return n;
  }
  function stageButtons(){
    const nav=$("ws-steps");nav.replaceChildren();
    const r=Core.normalize(record()),next=Core.nextStage(r);
    Core.STAGES.forEach((stage,i)=>{
      const b=document.createElement("button");b.type="button";b.disabled=true;b.textContent=`${i+1}. ${stage[0].toUpperCase()+stage.slice(1)}`;
      if(stage===next||(!next&&stage==="transfer"))b.setAttribute("aria-current","step");
      if(r.session.attempts[stage]?.passed)b.textContent="✓ "+b.textContent;
      nav.append(b);
    });
  }
  function tutor(){
    const s=state(),ps=Core.prerequisiteStatus(current,s),r=Core.normalize(record()),next=Core.nextStage(r);
    $("ws-count").textContent=`TI Concept ${cards.indexOf(current)+1} / ${cards.length} · ${current.sourceIds.join(" + ")}`;
    $("ws-title").textContent=current.title;
    $("ws-intro").textContent=current.problem;
    stageButtons();
    const q=$("ws-question");q.replaceChildren();$("ws-feedback").textContent="";
    $("ws-result").hidden=true;

    if(!ps.unlocked){
      const h=document.createElement("h2");h.textContent="Prerequisite locked";const p=document.createElement("p");p.textContent="Complete: "+ps.missing.join(", ");q.append(h,p);return;
    }
    if(!next){
      const h=document.createElement("h2");h.textContent="Concept loop complete";q.append(h);
      const box=document.createElement("div");box.className="ti-grade";
      box.innerHTML=`<strong>Grade: ${String(r.grade||"pass").toUpperCase()}</strong><p>Next review: ${r.nextReview||"—"}</p>`;q.append(box);
      const review=document.createElement("button");review.type="button";review.textContent="Start review now";
      review.onclick=()=>{const nextRecord=Core.startReview(r);save(current.id,nextRecord);render();};q.append(review);
      return;
    }

    const def=lab.stages[next],h=document.createElement("h2");h.textContent=next.toUpperCase();q.append(h);
    const prompt=document.createElement("p");prompt.textContent=def.prompt;q.append(prompt);
    const fs=document.createElement("fieldset"),legend=document.createElement("legend");legend.textContent="Commit before feedback";fs.append(legend);
    def.choices.forEach(([value,label])=>{
      const l=document.createElement("label"),i=document.createElement("input");i.type="radio";i.name="ti-concept-answer";i.value=value;
      l.append(i,document.createTextNode(" "+label));fs.append(l);
    });q.append(fs);
    const submit=document.createElement("button");submit.type="button";submit.className="primary";submit.textContent="Commit answer";
    submit.onclick=()=>{
      const answer=document.querySelector('input[name="ti-concept-answer"]:checked')?.value;
      if(!answer){$("ws-feedback").textContent="先選答案。";return;}
      const correct=answer===def.expected,at=new Date().toISOString();
      let updated=Core.applyAttempt(r,next,answer,def.expected,at);
      updated.grade=Core.grade(updated);
      if(updated.grade)updated.nextReview=Policy.nextReview(updated.grade,today());
      if(updated.completed){updated.lastReviewed=today();updated.completed=true;}
      save(current.id,updated);
      if(next==="predict"){
        try{E.commitPrediction("ti:"+current.id,{prediction:answer,parameters:"concept-lab-v1",confidence:70});}catch(_){}
      }
      E.recordOpenResponse("ti:"+current.id+":"+next,{answer,correct,firstAttempt:updated.session.attempts[next].attempts===1});
      if(updated.completed)E.recordEvidence("ti:"+current.id,2,"ti-concept-lab",{grade:updated.grade,nextReview:updated.nextReview,sourceIds:current.sourceIds},{stage:"practiced",strength:updated.grade==="transfer"?"B":"none"});
      $("ws-feedback").textContent=correct?"PASS — next causal stage":"Not yet — use the evidence surface and retry.";
      render();
    };q.append(submit);
  }
  function render(){setupChrome();nav();surface();tutor();}
  async function mount(){
    if(!E||!Core||!Policy)throw Error("TI concept lab dependencies missing");
    try{await loadData();}catch(error){$("ws-title").textContent="TI Concept Labs failed";$("ws-intro").textContent=error.message;console.error(error);}
  }
  return {mount};
});
