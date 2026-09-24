(function(root,factory){
  root.CircuitTIEvidenceLadder=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const readJson=file=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>{try{resolve(JSON.parse(String(r.result||"")));}catch(e){reject(e);}};r.onerror=()=>reject(r.error||new Error("read failed"));r.readAsText(file);});
  async function fetchJson(url){const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error(url+" "+r.status);return r.json();}
  async function mount({host,onSnapshot=null}={}){
    if(!host)throw new Error("evidence ladder host required");
    const Core=root.CircuitTIEvidenceLadderCore,Closure=root.CircuitPhysicalBoardClosureV1,Control=root.CircuitControlValidationV1;
    if(!Core||!Closure||!Control)throw new Error("evidence ladder dependencies missing");
    host.hidden=false;host.replaceChildren();
    const shell=el("div","ti-evidence-ladder");
    const head=el("div","ti-evidence-head");
    head.append(el("strong",null,"ENGINEERING TRUTH LADDER"),el("span",null,"model ≠ target ≠ board evidence"));
    const claim=el("div","ti-evidence-claim");
    claim.append(el("span",null,"Current claim ceiling"));
    const claimValue=el("strong",null,"UNCLAIMED");claimValue.dataset.evidenceClaim="";
    claim.append(claimValue);

    const stages=el("div","ti-evidence-stages");
    const physical=el("div","ti-evidence-physical");
    const boardCard=el("section"),controlCard=el("section");
    boardCard.append(el("strong",null,"P4-A · Physical board closure"));
    const boardStatus=el("b",null,"UNCLAIMED");boardStatus.dataset.evidenceBoard="";boardCard.append(boardStatus);
    const boardDetail=el("p");boardCard.append(boardDetail);
    controlCard.append(el("strong",null,"P4-B · Measured control validation"));
    const controlStatus=el("b",null,"INCOMPLETE_OR_FAIL");controlStatus.dataset.evidenceControl="";controlCard.append(controlStatus);
    const controlDetail=el("p");controlCard.append(controlDetail);
    physical.append(boardCard,controlCard);

    const imports=el("div","ti-evidence-imports");
    const softwareInput=el("input"),boardInput=el("input"),controlInput=el("input");
    for(const input of [softwareInput,boardInput,controlInput]){input.type="file";input.accept=".json,application/json";}
    softwareInput.dataset.evidenceImport="software";boardInput.dataset.evidenceImport="board";controlInput.dataset.evidenceImport="control";
    const softwareLabel=el("label");softwareLabel.append(el("span",null,"Software gate evidence JSON"),softwareInput);
    const boardLabel=el("label");boardLabel.append(el("span",null,"Board closure JSON"),boardInput);
    const controlLabel=el("label");controlLabel.append(el("span",null,"Control validation JSON"),controlInput);
    imports.append(softwareLabel,boardLabel,controlLabel);

    const blockers=el("details","ti-evidence-blockers"),summary=el("summary",null,"Remaining evidence actions"),blockerList=el("ol");
    blockers.append(summary,blockerList);
    const boundary=el("p","ti-evidence-boundary","Fail-closed rule: software/model evidence cannot manufacture BOARD_PASS or CONTROL_VALIDATION_PASS. Board and measured-control claims are computed only by the existing P4-A/P4-B validators with provenance-bound artifacts.");
    shell.append(head,claim,stages,physical,imports,blockers,boundary);host.append(shell);

    let software={},boardPackage={},controlBundle={};
    try{
      [boardPackage,controlBundle]=await Promise.all([
        fetchJson("19_c2000_buck_firmware_lab/board/board-closure.template.json"),
        fetchJson("19_c2000_buck_firmware_lab/board/control-validation.template.json")
      ]);
    }catch(error){blockerList.append(el("li",null,"Template load failed: "+error.message));}

    function render(){
      const result=Core.evaluate({software,boardPackage,controlBundle},{Closure,Control});
      stages.replaceChildren();
      for(const row of result.software.rows){
        const div=el("div","ti-evidence-stage "+(row.pass?"is-pass":"is-blocked"));
        div.dataset.evidenceStage=row.id;
        div.append(el("span",null,row.label),el("strong",null,row.pass?"PASS":"BLOCKED"),el("small",null,row.reason));
        stages.append(div);
      }
      claimValue.textContent=result.claimCeiling;
      boardStatus.textContent=result.board.computedClaim;
      boardDetail.textContent=result.boardPass
        ?"9/9 bindings + 8/8 physical captures + real flash closure satisfied."
        :result.board.remainingActions.length+" physical actions remain.";
      controlStatus.textContent=result.control.status;
      controlDetail.textContent=result.controlPass
        ?"Load-step, timing, trip latency and SFRA captures pass measured acceptance."
        :"Measured captures/analyses are incomplete or failing; BOARD_PASS is not implied.";
      blockerList.replaceChildren();
      result.blockers.slice(0,30).forEach(x=>blockerList.append(el("li",null,x)));
      if(typeof onSnapshot==="function")onSnapshot({
        claimCeiling:result.claimCeiling,
        softwareHighest:result.software.highest,
        boardClaim:result.board.computedClaim,
        controlStatus:result.control.status,
        boardPass:result.boardPass,
        controlPass:result.controlPass,
        blockerCount:result.blockers.length
      });
      return result;
    }
    softwareInput.onchange=async()=>{try{software=await readJson(softwareInput.files[0]);render();}catch(e){alert("Software evidence JSON rejected: "+e.message);}};
    boardInput.onchange=async()=>{try{boardPackage=await readJson(boardInput.files[0]);render();}catch(e){alert("Board closure JSON rejected: "+e.message);}};
    controlInput.onchange=async()=>{try{controlBundle=await readJson(controlInput.files[0]);render();}catch(e){alert("Control validation JSON rejected: "+e.message);}};
    render();
    return{render,getResult:()=>Core.evaluate({software,boardPackage,controlBundle},{Closure,Control}),destroy(){host.replaceChildren();}};
  }
  return Object.freeze({mount});
});
