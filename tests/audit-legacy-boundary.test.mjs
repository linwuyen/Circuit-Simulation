import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const paths=[...fs.readdirSync(new URL('7.28388d_bms_tutorial/legacy/',root)).filter(x=>x.endsWith('.html')).map(x=>'7.28388d_bms_tutorial/legacy/'+x),...fs.readdirSync(new URL('5_spi/originals/',root)).filter(x=>x.endsWith('.html')).map(x=>'5_spi/originals/'+x),'6.10μs 高頻控制迴路模擬器/10μs 高頻控制迴路模擬器.html'];
for(const path of paths)test(`${path}: direct legacy entry discloses its unvalidated boundary and usable return link`,()=>{
 const html=fs.readFileSync(new URL(path,root),'utf8');
 assert.match(html,/data-legacy-boundary/);
 assert.match(html,/未經本次模型回歸驗證/);
 assert.match(html,/不代表韌體、硬體或安全保護已通過驗證/);
 const link=html.match(/data-current-course href="([^"]+)"/);
 assert.ok(link);assert.ok(fs.existsSync(new URL(link[1],new URL(path,root))));
});
