import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const manifestPath=path.join(root,"docs","dynamic-visualization-audit.json");

function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(p));
    else if(entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(p);
  }
  return out;
}
function count(re,text){return [...text.matchAll(re)].length;}
function ids(re,text){return [...text.matchAll(re)].map(m=>m[1]).filter(Boolean);}
function inspectHtml(file){
  const text=fs.readFileSync(file,"utf8");
  const canvasIds=ids(/<canvas\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi,text);
  const svgIds=ids(/<svg\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi,text);
  const canvases=count(/<canvas\b/gi,text), svgs=count(/<svg\b/gi,text), ranges=count(/<input\b[^>]*\btype=["']range["']/gi,text), selects=count(/<select\b/gi,text);
  return { canvases, canvasIds, svgs, svgIds, ranges, selects, interactive:canvases>0||ranges>0||selects>0 };
}

export function runAudit(){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8"));
  if(!Array.isArray(manifest.modules)||manifest.modules.length!==20) throw new Error("audit manifest must declare exactly modules 0..19");
  const numbers=manifest.modules.map(x=>x.module).sort((a,b)=>a-b);
  for(let i=0;i<20;i++) if(numbers[i]!==i) throw new Error(`audit manifest missing module ${i}`);
  const allowed=new Set(Object.keys(manifest.contract));
  const visualRows=[];
  for(const policy of manifest.modules){
    if(!allowed.has(policy.defaultFidelity)) throw new Error(`module ${policy.module} has unknown fidelity ${policy.defaultFidelity}`);
    for(const field of ["model","validRegion","knownBoundary","action"]){if(!String(policy[field]||"").trim()) throw new Error(`module ${policy.module} missing ${field}`);}
    const dir=path.join(root,policy.pathPrefix);
    if(!fs.existsSync(dir)) throw new Error(`module ${policy.module} path missing: ${policy.pathPrefix}`);
    const htmlFiles=walk(dir);
    if(htmlFiles.length===0) throw new Error(`module ${policy.module} has no HTML to audit`);
    for(const file of htmlFiles){
      const visual=inspectHtml(file);
      if(!visual.interactive) continue;
      visualRows.push({module:policy.module,path:path.relative(root,file).replaceAll(path.sep,"/"),fidelity:policy.defaultFidelity,...visual});
    }
  }
  const declared17=new Map((manifest.module17Visuals||[]).map(x=>[x.id,x]));
  const m17=visualRows.filter(x=>x.module===17);
  const actual17=new Set(m17.flatMap(x=>x.canvasIds));
  for(const id of actual17) if(!declared17.has(id)) throw new Error(`Module 17 canvas #${id} has no explicit fidelity contract`);
  for(const [id,v] of declared17){
    if(!actual17.has(id)) throw new Error(`Module 17 manifest declares missing canvas #${id}`);
    if(v.fidelity!=="EQUATION_GRADE") throw new Error(`Module 17 upgraded canvas #${id} must be equation-grade or be removed from module17Visuals`);
    if(!String(v.units||"").trim()||!String(v.boundary||"").trim()) throw new Error(`Module 17 canvas #${id} needs units and boundary`);
  }
  return {manifest,visualRows,summary:{modules:20,interactiveFiles:visualRows.length,canvases:visualRows.reduce((a,x)=>a+x.canvases,0),svgs:visualRows.reduce((a,x)=>a+x.svgs,0),ranges:visualRows.reduce((a,x)=>a+x.ranges,0),selects:visualRows.reduce((a,x)=>a+x.selects,0)}};
}

const invokedPath=process.argv[1] ? path.resolve(process.argv[1]) : "";
if(invokedPath && fileURLToPath(import.meta.url)===invokedPath){
  const {summary,visualRows}=runAudit();
  console.log(`Dynamic visualization audit PASS: ${summary.modules} modules, ${summary.interactiveFiles} interactive HTML files, ${summary.canvases} canvases, ${summary.svgs} SVGs, ${summary.ranges} range controls, ${summary.selects} selects.`);
  for(const module of Array.from({length:20},(_,i)=>i)){
    const rows=visualRows.filter(x=>x.module===module);
    console.log(`M${String(module).padStart(2,"0")}: ${rows.length} interactive files`);
  }
}
