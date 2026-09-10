import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runCheck,summarize,hierarchy} from '../tools/ci/verification-manifest.mjs';
const commitSha='a'.repeat(40);
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'verification-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));return {directory,cwd:directory,commitSha,scope:'fixture'};}
test('failed command retains evidence and missing artifacts cannot pass',async t=>{
 const opts=fixture(t);
 const failed=await runCheck({...opts,stage:'UNIT',command:[process.execPath,'-e','process.exit(7)']});
 assert.equal(failed.record.verdict,'FAIL');assert.ok(fs.existsSync(failed.manifestPath));
 const missing=await runCheck({...opts,stage:'MODEL',artifacts:['missing.bin'],command:[process.execPath,'-e','process.exit(0)']});
 assert.equal(missing.record.verdict,'UNKNOWN');
 assert.equal(summarize(opts.directory,{commitSha}).softwareVerdict,'FAIL');
 for(const dir of ['first','second']){fs.mkdirSync(path.join(opts.cwd,dir));fs.writeFileSync(path.join(opts.cwd,dir,'image.bin'),dir);}
 const packaged=await runCheck({...opts,stage:'FLASH_IMAGE',artifacts:['first/image.bin','second/image.bin'],command:[process.execPath,'-e','process.exit(0)']});
 assert.equal(packaged.record.verdict,'PASS');
 const images=packaged.record.artifacts.filter(a=>a.kind==='required-artifact');
 assert.equal(new Set(images.map(a=>a.packagedPath)).size,2);
 assert.notEqual(images[0].sha256,images[1].sha256);
});
test('software success never awards physical evidence; corrupt or foreign evidence fails closed',async t=>{
 const opts=fixture(t);
 for(const stage of hierarchy.stages.filter(s=>!s.physical))await runCheck({...opts,stage:stage.name,command:[process.execPath,'-e','console.log("software fixture only")']});
 let summary=summarize(opts.directory,{commitSha});
 assert.equal(summary.softwareVerdict,'PASS');assert.equal(summary.boardVerdict,'UNCLAIMED');
 assert.ok(summary.stages.filter(s=>s.physical).every(s=>s.verdict==='BLOCKED'));
 assert.equal(summarize(opts.directory,{commitSha:'b'.repeat(40)}).softwareVerdict,'FAIL');
 fs.writeFileSync(path.join(opts.directory,'broken.json'),'{');
 assert.equal(summarize(opts.directory,{commitSha}).softwareVerdict,'FAIL');
 fs.unlinkSync(path.join(opts.directory,'broken.json'));
 fs.appendFileSync(path.join(opts.directory,summary.checks[0].artifacts[0].packagedPath),'tampered');
 assert.equal(summarize(opts.directory,{commitSha}).softwareVerdict,'FAIL');
 await assert.rejects(runCheck({...opts,stage:'BOARD_EVIDENCE',command:[process.execPath,'-e','process.exit(0)']}),/Physical evidence/);
});
