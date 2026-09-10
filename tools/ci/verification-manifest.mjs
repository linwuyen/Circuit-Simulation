import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const hierarchy=JSON.parse(fs.readFileSync(new URL('./verification-stages.json',import.meta.url),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const slash=value=>value.split(path.sep).join('/');
const safe=value=>String(value).replace(/[^a-zA-Z0-9_-]/g,'-');
function contained(base,relative){const resolved=path.resolve(base,relative),rel=path.relative(base,resolved);if(rel.startsWith('..')||path.isAbsolute(rel))throw Error('Evidence path escapes package: '+relative);return resolved;}
export async function runCheck({stage,check='main',command,artifacts=[],cwd=process.cwd(),directory,scope=process.env.VERIFICATION_SCOPE||process.platform,commitSha=process.env.GITHUB_SHA||process.env.REPOSITORY_COMMIT||'UNKNOWN'}){
  const spec=hierarchy.stages.find(s=>s.name===stage);if(!spec)throw Error('Unknown verification stage: '+stage);
  if(spec.physical)throw Error('Physical evidence cannot be awarded by a generic software command; use the existing board/control-validation owners.');
  if(!Array.isArray(command)||!command.length)throw Error('A real command is required');
  directory=directory||path.join(cwd,'build','verification',safe(scope));fs.mkdirSync(directory,{recursive:true});
  const stem=safe(scope)+'-'+stage+'-'+safe(check),logPath=path.join(directory,stem+'.log'),manifestPath=path.join(directory,stem+'.json');
  const log=fs.createWriteStream(logPath),startedAt=new Date().toISOString();let output='',error=null;
  const result=await new Promise(resolve=>{
    const child=spawn(command[0],command.slice(1),{cwd,windowsHide:true,shell:false,env:process.env});
    const append=(chunk,stream)=>{const text=chunk.toString();output+=text;log.write(text);stream.write(text);};
    child.stdout.on('data',chunk=>append(chunk,process.stdout));child.stderr.on('data',chunk=>append(chunk,process.stderr));
    child.on('error',e=>{error=e.message;log.write(e.message+'\n');});child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));
  });
  await new Promise(resolve=>log.end(resolve));
  const files=[{path:slash(path.relative(cwd,logPath)),packagedPath:path.basename(logPath),sha256:sha(logPath),bytes:fs.statSync(logPath).size,kind:'log'}],missing=[];
  for(const artifact of artifacts){
    let file;try{file=contained(cwd,artifact);}catch(e){missing.push({path:artifact,reason:e.message});continue;}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()||fs.statSync(file).size===0){missing.push({path:artifact,reason:'missing or empty'});continue;}
    const relative=slash(path.join('files-'+stem,artifact));const copy=contained(directory,relative);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(file,copy);
    files.push({path:slash(artifact),packagedPath:relative,sha256:sha(copy),bytes:fs.statSync(copy).size,kind:'required-artifact'});
  }
  const verdict=error||result.exitCode!==0?'FAIL':missing.length?'UNKNOWN':'PASS';
  const counts={};for(const name of ['tests','pass','fail','skipped']){const match=output.match(new RegExp('^# '+name+' (\\d+)','m'));if(match)counts[name]=Number(match[1]);}
  const record={schema:'circuit-verification-stage',version:1,commitSha,scope,startedAt,timestamp:new Date().toISOString(),
    tool:{runner:'verification-manifest',version:1,node:process.version,platform:process.platform},stage:spec.id,stageName:spec.name,claim:spec.claim,
    input:{command},expected:{exitCode:0,nonEmptyArtifacts:artifacts},actual:{...result,error,missingArtifacts:missing,counts},verdict,
    artifacts:files,boundary:hierarchy.boundary};
  fs.writeFileSync(manifestPath,JSON.stringify(record,null,2)+'\n');
  if(verdict!=='PASS')process.stderr.write(JSON.stringify({FAIL_STAGE:stage,FAILED_CHECK:check,EXPECTED:record.expected,ACTUAL:record.actual,EVIDENCE_PATH:slash(path.relative(cwd,manifestPath)),VERDICT:verdict})+'\n');
  return {record,manifestPath};
}
function walk(directory){if(!fs.existsSync(directory))return [];return fs.readdirSync(directory,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(directory,e.name)):[path.join(directory,e.name)]);}
export function summarize(directory,{commitSha=process.env.GITHUB_SHA||process.env.REPOSITORY_COMMIT||'UNKNOWN'}={}){
  const checks=[];
  for(const file of walk(directory).filter(p=>p.endsWith('.json'))){
    let r;try{r=JSON.parse(fs.readFileSync(file,'utf8'));}catch{checks.push({stage:-1,verdict:'UNKNOWN',reason:'invalid JSON',path:file});continue;}
    if(r.schema!=='circuit-verification-stage')continue;
    const failures=[];
    if(!hierarchy.stages.some(s=>s.id===r.stage&&s.name===r.stageName&&!s.physical))failures.push('unrecognized software stage identity');
    if(r.commitSha!==commitSha||! /^[a-f0-9]{40}$/i.test(r.commitSha))failures.push('commit SHA is missing or mismatched');
    if(!Array.isArray(r.artifacts)||!r.artifacts.length)failures.push('evidence artifacts missing');
    for(const a of r.artifacts||[]){try{const full=contained(path.dirname(file),a.packagedPath);if(!fs.existsSync(full)||sha(full)!==a.sha256||fs.statSync(full).size!==a.bytes)failures.push('missing or changed artifact: '+a.packagedPath);}catch(e){failures.push(e.message);}}
    if(r.verdict==='PASS'&&(r.actual?.exitCode!==0||r.actual?.missingArtifacts?.length))failures.push('PASS contradicts command/artifact result');
    checks.push({...r,verdict:failures.length?'UNKNOWN':r.verdict,integrityFailures:failures,manifestPath:slash(path.relative(directory,file))});
  }
  const stages=hierarchy.stages.map(spec=>{
    const rows=checks.filter(c=>c.stage===spec.id);let verdict;
    if(spec.physical)verdict='BLOCKED';
    else if(!rows.length)verdict='NOT_RUN';
    else if(rows.some(r=>r.verdict==='FAIL'))verdict='FAIL';
    else if(rows.some(r=>r.verdict!=='PASS'))verdict='UNKNOWN';
    else verdict='PASS';
    return {...spec,verdict,evidenceStatus:spec.physical?'UNKNOWN':rows.length?'PRESENT':'MISSING',checks:rows.map(r=>r.manifestPath),
      reason:spec.physical?'No real provenance-bound measurement package was provided; CI cannot manufacture it.':undefined};
  });
  return {schema:'circuit-verification-manifest',version:1,commitSha,timestamp:new Date().toISOString(),tool:{node:process.version,version:1},
    softwareVerdict:checks.every(c=>c.verdict==='PASS')&&stages.filter(s=>!s.physical).every(s=>s.verdict==='PASS')?'PASS':'FAIL',boardVerdict:'UNCLAIMED',stages,checks,boundary:hierarchy.boundary};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  try{
    if(args[0]==='summarize'){
      const directory=path.resolve(args[1]||'build/verification'),result=summarize(directory);fs.mkdirSync(directory,{recursive:true});
      fs.writeFileSync(path.join(directory,'manifest.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({software:result.softwareVerdict,board:result.boardVerdict,stages:result.stages.map(s=>({stage:s.id,name:s.name,verdict:s.verdict}))}));
      if(args.includes('--require-software')&&result.softwareVerdict!=='PASS')process.exitCode=1;
    }else{
      const split=args.indexOf('--');if(split<1)throw Error('Usage: verification-manifest.mjs STAGE [--check id] [--artifact relative-path] -- executable args...');
      const opts={stage:args[0],command:args.slice(split+1),artifacts:[]};
      for(let i=1;i<split;i++){if(args[i]==='--check')opts.check=args[++i];else if(args[i]==='--artifact')opts.artifacts.push(args[++i]);else throw Error('Unknown option: '+args[i]);}
      const {record}=await runCheck(opts);if(record.verdict!=='PASS')process.exitCode=1;
    }
  }catch(error){console.error(error.message);process.exitCode=1;}
}
