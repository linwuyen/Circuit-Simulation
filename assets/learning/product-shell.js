(function(root,factory){
  const api=factory(root);
  root.CircuitProductShell=api;
  const start=()=>api.mount().catch(error=>root.console?.warn?.("Product shell mount failed",error));
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else queueMicrotask(start);
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";
  const DIAG_KEY="circuit-product-diagnostics-v1";
  const DIAG_MAX=50;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
  const clip=(value,max=300)=>String(value??"").replace(/\s+/g," ").slice(0,max);
  function readDiagnostics(){
    try{const v=JSON.parse(root.localStorage?.getItem(DIAG_KEY)||"[]");return Array.isArray(v)?v:[];}catch{return[];}
  }
  function writeDiagnostics(rows){
    try{root.localStorage?.setItem(DIAG_KEY,JSON.stringify(rows.slice(-DIAG_MAX)));}catch{}
  }
  function recordDiagnostic(type,data={}){
    const row={at:new Date().toISOString(),type:clip(type,40)};
    for(const[k,v]of Object.entries(data))row[k]=typeof v==="number"&&Number.isFinite(v)?v:clip(v);
    const rows=readDiagnostics();rows.push(row);writeDiagnostics(rows);return row;
  }
  function setupDiagnostics(){
    if(root.__circuitProductDiagnosticsBound)return;
    root.__circuitProductDiagnosticsBound=true;
    root.addEventListener?.("error",event=>recordDiagnostic("error",{message:event.message,source:(event.filename||"").split("/").pop(),line:event.lineno||0}));
    root.addEventListener?.("unhandledrejection",event=>recordDiagnostic("unhandledrejection",{message:event.reason?.message||event.reason||"unknown"}));
    root.addEventListener?.("load",()=>{
      const nav=root.performance?.getEntriesByType?.("navigation")?.[0];
      if(nav)recordDiagnostic("navigation",{domContentLoadedMs:Math.round(nav.domContentLoadedEventEnd),loadMs:Math.round(nav.loadEventEnd),transferBytes:nav.transferSize||0});
      for(const p of root.performance?.getEntriesByType?.("paint")||[])recordDiagnostic("paint",{name:p.name,startMs:Math.round(p.startTime)});
    },{once:true});
  }
  async function registerServiceWorker(){
    if(!("serviceWorker" in navigator))return{status:"UNSUPPORTED"};
    const secure=location.protocol==="https:"||["localhost","127.0.0.1"].includes(location.hostname);
    if(!secure)return{status:"INSECURE_CONTEXT"};
    try{
      const registration=await navigator.serviceWorker.register("./service-worker.js",{scope:"./"});
      return{status:"REGISTERED",scope:registration.scope};
    }catch(error){
      recordDiagnostic("service-worker-error",{message:error.message});
      return{status:"ERROR",message:error.message};
    }
  }
  function downloadJson(filename,text){
    const blob=new Blob([text],{type:"application/json"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
  }
  function backupPreview(payload){
    if(!payload||payload.schema!=="circuit-learning-state"||payload.version!==5)throw new Error("Only Evidence V5 backups are supported.");
    return{
      evidence:Object.keys(payload.evidence||{}).length,
      predictions:Object.keys(payload.predictions||{}).length,
      openResponses:Object.keys(payload.openResponses||{}).length,
      benchmark:Object.keys(payload.benchmark||{}).length,
      updatedAt:payload.updatedAt||"unknown"
    };
  }
  async function mount(){
    setupDiagnostics();
    const E=root.CircuitEvidence;
    const toolbar=document.querySelector(".workspace-header .toolbar");
    if(!E||!toolbar)return;
    if(document.getElementById("open-product-shell"))return;
    const button=el("button",null,"App / Backup");button.id="open-product-shell";button.type="button";toolbar.append(button);
    const drawer=el("section","product-shell-drawer");drawer.id="product-shell-drawer";drawer.hidden=true;
    const main=document.querySelector("main")||document.body;main.prepend(drawer);

    const head=el("div","product-shell-head"),title=el("strong",null,"Circuit Simulation · Product Shell"),close=el("button",null,"×");close.type="button";head.append(title,close);
    const release=el("div","product-release-card","Loading release metadata…");
    const pwa=el("div","product-pwa-card"),pwaStatus=el("span",null,"PWA checking…"),install=el("button",null,"Install app");install.type="button";install.hidden=true;pwa.append(pwaStatus,install);

    const backup=el("section","product-backup"),backupTitle=el("strong",null,"Evidence V5 backup / merge");
    const backupActions=el("div"),download=el("button",null,"Download V5 backup"),file=el("input"),merge=el("button",null,"Merge selected backup");
    download.type=merge.type="button";file.type="file";file.accept=".json,application/json";file.dataset.productImport="";merge.disabled=true;backupActions.append(download,file,merge);
    const preview=el("p","product-backup-preview","No backup selected.");backup.append(backupTitle,backupActions,preview);

    const diagnostics=el("section","product-diagnostics"),diagTitle=el("strong",null,"Local diagnostics");
    const diagActions=el("div"),exportDiag=el("button",null,"Export diagnostics"),clearDiag=el("button",null,"Clear diagnostics");
    exportDiag.type=clearDiag.type="button";diagActions.append(exportDiag,clearDiag);
    const diagStatus=el("p",null,readDiagnostics().length+" local records · never auto-uploaded");diagnostics.append(diagTitle,diagActions,diagStatus);

    const sync=el("section","product-sync");
    sync.append(el("strong",null,"Cloud sync boundary"),el("p",null,"NOT CONFIGURED · future sync may transport one Evidence V5 backup blob and must restore through CircuitEvidence.merge(). No second progress schema."));
    const tiers=el("div","product-tiers");
    drawer.append(head,release,pwa,backup,diagnostics,sync,tiers);

    let pendingImport=null,deferredInstall=null;
    try{
      const [rel,tierData]=await Promise.all([
        fetch("product/release.json",{cache:"no-store"}).then(r=>r.json()),
        fetch("product/tiers.json",{cache:"no-store"}).then(r=>r.json())
      ]);
      release.replaceChildren();
      release.append(el("strong",null,rel.version+" · "+String(rel.channel).toUpperCase()),el("span",null,rel.publicUrl),el("small",null,"custom domain: "+rel.customDomainStatus+" · state V"+rel.state.version));
      tiers.replaceChildren(el("strong",null,"Packaging"));
      for(const tier of tierData.tiers){
        const card=el("section");card.append(el("b",null,tier.label),el("span",null,tier.includes.join(" · ")));tiers.append(card);
      }
    }catch(error){release.textContent="Release metadata unavailable: "+error.message;}

    const sw=await registerServiceWorker();pwaStatus.textContent="PWA: "+sw.status+(sw.scope?" · "+sw.scope:"");
    root.addEventListener?.("beforeinstallprompt",event=>{event.preventDefault();deferredInstall=event;install.hidden=false;});
    install.onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;install.hidden=true;};

    button.onclick=()=>{drawer.hidden=false;};
    close.onclick=()=>{drawer.hidden=true;};
    download.onclick=()=>{
      const stamp=new Date().toISOString().slice(0,10);
      downloadJson("circuit-learning-v5-"+stamp+".json",E.exportBackup());
    };
    file.onchange=async()=>{
      merge.disabled=true;pendingImport=null;
      try{
        const selected=file.files?.[0];if(!selected){preview.textContent="No backup selected.";return;}
        const payload=JSON.parse(await selected.text()),counts=backupPreview(payload);
        pendingImport=payload;merge.disabled=false;
        preview.textContent="Preview only — no mutation yet · evidence "+counts.evidence+" · predictions "+counts.predictions+" · responses "+counts.openResponses+" · benchmark "+counts.benchmark+" · updated "+counts.updatedAt;
      }catch(error){preview.textContent="Rejected: "+error.message;}
    };
    merge.onclick=()=>{
      if(!pendingImport)return;
      try{
        E.merge(pendingImport);preview.textContent="Merged through CircuitEvidence.merge(); local first-attempt preservation rules remain authoritative.";merge.disabled=true;pendingImport=null;
        document.dispatchEvent(new CustomEvent("circuit-evidence-merged"));
      }catch(error){preview.textContent="Merge rejected: "+error.message;}
    };
    exportDiag.onclick=()=>downloadJson("circuit-product-diagnostics.json",JSON.stringify({schema:"circuit-product-diagnostics",version:1,exportedAt:new Date().toISOString(),records:readDiagnostics()},null,2));
    clearDiag.onclick=()=>{writeDiagnostics([]);diagStatus.textContent="0 local records · never auto-uploaded";};
    return{drawer,serviceWorker:sw};
  }
  return Object.freeze({DIAG_KEY,DIAG_MAX,readDiagnostics,recordDiagnostic,backupPreview,registerServiceWorker,mount});
});
