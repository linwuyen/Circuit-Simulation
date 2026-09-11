const {test,expect}=require('@playwright/test');
test('map displays practice and assessment separately without rewriting records',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/map.html');await expect(page.locator('#workspace-learning-records')).toBeVisible();
 const saved=await page.evaluate(()=>{localStorage.clear();const s=CircuitEvidence.load();s.benchmark.learningWorkspace={version:1,experiment:{version:1,rows:{energy:{first:{correct:false},proof:{observation:true,reason:true},transferPassed:true}}},topologyApplications:{version:1,rows:{pfc:{protocol:'topology-application-v1',first:{correct:false},operated:true,observationPassed:true,reasonPassed:true}}}};CircuitEvidence.save(s);return JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace);});
 await page.reload();const exp=page.locator('[data-record-group=experiment]'),apps=page.locator('[data-record-group=applications]'),assessment=page.locator('[data-record-group=topology-assessment]');await expect(exp).toContainText('1 / 8');await expect(apps).toContainText('1 / 4');await expect(assessment).toContainText('0 / 4');
 await exp.locator('summary').focus();await page.keyboard.press('Enter');await expect(exp.locator('[data-record-id=energy]')).toBeVisible();await expect(exp).toContainText('首次答錯');
 expect(await page.evaluate(()=>JSON.stringify(CircuitEvidence.load().benchmark.learningWorkspace))).toBe(saved);
 await expect(page.locator('#earlier-learning-records')).not.toHaveAttribute('open','');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(process.env.CAPTURE_UI)await page.screenshot({path:'work/map-'+info.project.name+'.png',fullPage:true});
 await assessment.getByRole('link').click();await expect(page).toHaveURL(/quiz.html\?module=power-topology-control/);await expect(page.locator('[data-current-question]')).toHaveCount(4);expect(errors).toEqual([]);
});
