const {test,expect}=require('@playwright/test');
async function open(page){await page.goto('/map.html');await page.waitForSelector('#workspace-learning-records');}
async function upload(page,payload){await page.locator('#learning-backup-file').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))});}
test('backup preview and cancellation preserve local records',async({page})=>{
 await open(page);const original=await page.evaluate(()=>CircuitEvidence.exportBackup());await upload(page,original);
 await expect(page.locator('#learning-backup-confirm')).toBeEnabled();expect(await page.evaluate(()=>CircuitEvidence.exportBackup())).toBe(original);
 await page.locator('#learning-backup-cancel').click();await expect(page.locator('#learning-backup-confirm')).toBeHidden();expect(await page.evaluate(()=>CircuitEvidence.exportBackup())).toBe(original);
 await upload(page,'{"schema":"wrong","version":5}');await expect(page.locator('#learning-backup-status')).toContainText('無法');expect(await page.evaluate(()=>CircuitEvidence.exportBackup())).toBe(original);
 const invalid=JSON.parse(original);invalid.auxiliary.coreFlow={version:999};await upload(page,invalid);await page.locator('#learning-backup-confirm').click();await expect(page.locator('#learning-backup-status')).toContainText('無法合併');expect(await page.evaluate(()=>CircuitEvidence.exportBackup())).toBe(original);
});
test('map restores a complete backup and refreshes continuation in place',async({page})=>{
 await open(page);const payload=await page.evaluate(()=>{const p=JSON.parse(CircuitEvidence.exportBackup());p.benchmark.learningWorkspace={version:1,experiment:{version:1,completed:false,rows:Object.fromEntries(CircuitWorkspace.experimentLessons().map(l=>[l.id,{first:{correct:false},proof:{observation:true,reason:true},transferPassed:true}]))}};return p;});
 await upload(page,payload);await expect(page.locator('#learning-backup-preview')).toContainText('8 / 8');await expect(page.locator('[data-record-group=experiment]')).toContainText('0 / 8');
 await page.locator('#learning-backup-confirm').click();await expect(page.locator('[data-record-group=experiment]')).toContainText('8 / 8');await expect(page.locator('[data-learning-hub] [data-unified-resume]')).toHaveAttribute('href',/#topology$/);await expect(page.locator('#learning-backup-status')).toContainText('已合併');await expect(page).toHaveURL(/map.html$/);
});
test('merging keeps existing local first attempts',async({page})=>{
 await open(page);const payload=await page.evaluate(()=>{const e=CircuitEvidence.load();e.benchmark.learningWorkspace={version:1,experiment:{version:1,rows:{energy:{first:{correct:false,answer:'local'}}}}};CircuitEvidence.save(e);const p=JSON.parse(CircuitEvidence.exportBackup());p.benchmark.learningWorkspace.experiment.rows.energy.first={correct:true,answer:'incoming'};return p;});await page.reload();
 await upload(page,payload);await page.locator('#learning-backup-confirm').click();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.experiment.rows.energy.first)).toEqual({correct:false,answer:'local'});
});
