const {test,expect}=require('@playwright/test');
test('four application families use canonical quiz history, reload and native return',async({page},testInfo)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/quiz.html?module=power-topology-control');await page.evaluate(()=>localStorage.clear());await page.reload();
 await expect(page.locator('#topology-assessment-context')).toBeVisible();await expect(page.locator('[data-current-question]')).toHaveCount(4);
 await expect(page.locator('.core-quiz-path')).not.toHaveAttribute('open','');
 await page.locator('#topology-assessment-context').scrollIntoViewIfNeeded();
 if(process.env.CAPTURE_UI)await page.screenshot({path:'work/transfer-quiz-'+testInfo.project.name+'.png'});
 const family='topology-pfc-scaling';
 await page.locator(`[data-family="${family}"][data-option="correct"]`).click();
 await page.locator(`[data-family="${family}"][data-option="wrong-0"]`).click();
 await page.reload();
 expect(await page.evaluate(id=>CircuitEvidence.load().questions[id].history.filter(h=>h.assessmentRole==='transfer')[0].correct,family)).toBe(false);
 await page.locator(`[data-family="${family}"][data-option="correct"]`).click();
 expect(await page.evaluate(id=>CircuitAssessment.metrics(CircuitEvidence.load().questions[id]).transfer,family)).toBe(true);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace?.topologyApplications)).toBeUndefined();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('link',{name:'回原電路操作',exact:true}).click();await expect(page.locator('#application-prepare')).toBeVisible();expect(errors).toEqual([]);
});
test('home resumes unfinished topology assessment and returns to core after all four transfers',async({page})=>{
 await page.goto('/');await page.evaluate(()=>{localStorage.clear();const s=CircuitEvidence.load();s.benchmark.learningWorkspace={version:1,experiment:{version:1,completed:true},topologyTransfer:{version:1,completed:true},topologyApplications:{version:1,completed:true}};CircuitEvidence.save(s);});
 expect(await page.evaluate(()=>CircuitUnifiedLearning.next(CircuitEvidence.load(),{}).id)).toBe('topology-assessment');
 await page.goto('/quiz.html?module=power-topology-control');
 for(const id of ['pfc','psfb','llc','inverter']){const b=page.locator(`[data-family="topology-${id}-scaling"][data-option="correct"]`);await b.click();await b.click();if(id!=='inverter')await page.locator('[data-quiz-next]').click();}
 expect(await page.evaluate(()=>CircuitUnifiedLearning.next(CircuitEvidence.load(),{}).id)).toBe('core-physics');
});
