(function(root,factory){
  root.CircuitTITutor=factory(root);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  async function copyText(text){
    if(root.navigator?.clipboard?.writeText){await root.navigator.clipboard.writeText(text);return true;}
    const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.append(ta);ta.select();
    const ok=document.execCommand?.("copy")===true;ta.remove();return ok;
  }
  function mount({host,getPacket,onClose=null}={}){
    if(!host||typeof getPacket!=="function")throw new Error("tutor host/getPacket required");
    const Core=root.CircuitTITutorCore;if(!Core)throw new Error("tutor core missing");
    host.hidden=false;host.replaceChildren();
    const shell=el("section","ti-tutor-panel");
    const head=el("div","ti-tutor-head"),title=el("strong",null,"EVIDENCE-AWARE TUTOR"),mode=el("span",null,"LOCAL GUARDRAIL MODE"),close=el("button",null,"×");
    close.type="button";close.title="Close Tutor";head.append(title,mode,close);
    const status=el("p","ti-tutor-status");
    const question=el("div","ti-tutor-question"),qLabel=el("span",null,"Next smallest question"),qText=el("strong");
    question.append(qLabel,qText);
    const evidence=el("div","ti-tutor-evidence"),eLabel=el("span",null,"Evidence request"),eText=el("p");
    evidence.append(eLabel,eText);
    const context=el("div","ti-tutor-context");
    const sources=el("div","ti-tutor-sources");
    const actions=el("div","ti-tutor-actions"),refresh=el("button",null,"Refresh from V5 evidence"),copy=el("button",null,"Copy AI coach packet");
    refresh.type=copy.type="button";actions.append(refresh,copy);
    const note=el("p","ti-tutor-note","Local mode chooses the next constrained question; it does not call an LLM, assign independent evidence, or invent TI page/section citations.");
    shell.append(head,status,question,evidence,context,sources,actions,note);host.append(shell);
    let packet=null,request=null;
    function render(){
      packet=getPacket();
      if(!packet){status.textContent="No TI concept is active.";qText.textContent="Open a TI concept first.";eText.textContent="—";copy.disabled=true;return;}
      const gap=Core.firstGap(packet);request=Core.providerRequest(packet);
      status.textContent=packet.predictionCommitted
        ?packet.title+" · "+String(packet.mode).toUpperCase()+" · prediction "+(packet.predictionPreRegistered?"PRE-REGISTERED":"LATE")
        :packet.title+" · PREDICTION LOCK";
      status.dataset.tutorStatus=packet.predictionCommitted?"ready":"locked";
      qText.textContent=gap.question;qText.dataset.tutorQuestion=gap.id;
      eText.textContent=gap.evidenceRequest;
      context.replaceChildren();
      const rows=[
        ["Selected component",packet.uiContext.selectedComponent||"—"],
        ["Scope phase",packet.uiContext.scopePhase==null?"—":Math.round(packet.uiContext.scopePhase*100)+"%"],
        ["Machine evidence",packet.machineSnapshot?"available":"none"],
        ["Evidence strength",packet.evidenceStrength],
        ["Next review",packet.nextReview||"—"]
      ];
      for(const[label,value]of rows){const row=el("div");row.append(el("span",null,label),el("b",null,String(value)));context.append(row);}
      sources.replaceChildren();
      if(packet.predictionCommitted){
        const sHead=el("strong",null,"Closed TI sources");sources.append(sHead);
        for(const doc of packet.sources){
          const a=el("a",null,doc.id+" — "+doc.title);a.href=doc.url;a.target="_blank";a.rel="noopener";sources.append(a);
        }
      }else{
        sources.append(el("span",null,"Source/model reveal stays locked until prediction commit."));
      }
      copy.disabled=!packet.predictionCommitted;
    }
    refresh.onclick=render;
    copy.onclick=async()=>{
      if(!request)return;
      try{const ok=await copyText(JSON.stringify(request,null,2));copy.textContent=ok?"Copied":"Copy failed";}
      catch(error){copy.textContent="Copy failed";}
      root.setTimeout(()=>{copy.textContent="Copy AI coach packet";},1200);
    };
    close.onclick=()=>{host.hidden=true;if(typeof onClose==="function")onClose();};
    render();
    return{render,destroy(){host.replaceChildren();},getPacket:()=>packet,getRequest:()=>request};
  }
  return Object.freeze({mount});
});
