import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=fileURLToPath(new URL("../../",import.meta.url));
const cacheDir=path.join(root,".learning-cache");
const evidenceFile=path.join(cacheDir,"ti-closure-evidence.md");

function run(name,command,args){
  const started=Date.now();
  const r=spawnSync(command,args,{cwd:root,encoding:"utf8",shell:false});
  return {
    name,
    command:[command,...args].join(" "),
    passed:r.status===0,
    status:r.status,
    durationMs:Date.now()-started,
    stdout:(r.stdout||"").trim(),
    stderr:(r.stderr||"").trim()
  };
}

function git(args){
  const r=spawnSync("git",args,{cwd:root,encoding:"utf8"});
  return r.status===0?(r.stdout||"").trim():null;
}

async function safeRead(file){
  try{return await readFile(file,"utf8");}catch{return "";}
}

async function main(){
  await mkdir(cacheDir,{recursive:true});
  const generatedAt=new Date().toISOString();
  const head=git(["rev-parse","HEAD"]);
  const branch=git(["branch","--show-current"]);

  const steps=[];
  steps.push(run("bootstrap","npm",["run","learning:ti:bootstrap"]));
  steps.push(run("focused-node","npm",["run","learning:ti:validate"]));
  steps.push(run("playwright-ti-loop","npx",["playwright","test","tests/e2e/ti-learning-workbench.spec.js","--project=desktop"]));

  const bootstrapEvidence=await safeRead(path.join(cacheDir,"codespace-evidence.md"));
  const browserMissing=steps[2].stderr.includes("Executable doesn't exist")||steps[2].stderr.includes("browserType.launch");
  const allPassed=steps.every(s=>s.passed);

  const lines=[
    "# TI Learning Closure Evidence",
    "",
    `- generated: ${generatedAt}`,
    `- branch: ${branch??"unknown"}`,
    `- HEAD: ${head??"unknown"}`,
    `- Node: ${process.version}`,
    "",
    "## Gates",
    ...steps.map(s=>`- ${s.passed?"PASS":"FAIL"} — ${s.name} — ${s.durationMs} ms`),
    "",
    "## Bootstrap provenance",
    bootstrapEvidence.trim()||"codespace-evidence.md missing",
    "",
    "## Commands",
    ...steps.map(s=>`- ${s.command}`),
    "",
    browserMissing?"Browser runtime missing. Install once with: npx playwright install chromium":"",
    "",
    allPassed?"TI_CLOSURE_PASS":"TI_CLOSURE_FAIL",
    ""
  ].filter((line,i,arr)=>line!==""||arr[i-1]!=="").join("\n");

  await writeFile(evidenceFile,lines,"utf8");
  console.log(lines);

  for(const step of steps){
    if(!step.passed){
      console.error(`\n--- ${step.name} stderr ---\n${step.stderr}`);
      if(step.stdout)console.error(`\n--- ${step.name} stdout ---\n${step.stdout}`);
    }
  }
  if(!allPassed)process.exit(1);
}

main().catch(error=>{
  console.error(error.stack||error);
  process.exit(1);
});
