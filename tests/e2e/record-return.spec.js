const {test,expect}=require('@playwright/test');
test('map opens the selected native application without creating practice evidence',async({page})=>{
 await page.goto('/map.html');await expect(page.locator('#workspace-learning-records')).toBeVisible();
 const group=page.locator('[data-record-group=applications]');await group.locator('summary').click();await group.locator('[data-record-id=llc]').getByRole('link').click();
 await expect(page).toHaveURL(/lesson=llc#guided-applications/);await expect(page.locator('#application-prepare')).toBeVisible();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace?.topologyApplications)).toBeUndefined();
 await page.locator('#application-prepare').click();expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.currentLesson)).toBe('llc');
 await page.getByRole('button',{name:'交流整流（PFC）',exact:true}).count().then(async n=>{if(n)await page.getByRole('button',{name:'交流整流（PFC）',exact:true}).click();else await page.locator('#guided-applications nav button').first().click();});
 await page.reload();await expect(page).toHaveURL(/lesson=pfc/);expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace.topologyApplications.currentLesson)).toBe('pfc');
});
test('selected quiz family preserves first attempts and unknown family falls back within the module',async({page})=>{
 await page.goto('/quiz.html?module=power-topology-control&family=topology-psfb-scaling');await expect(page.locator('[data-current-question]')).toHaveCount(1);await expect(page.locator('[data-family="topology-psfb-scaling"]')).toHaveCount(4);
 await page.locator('[data-option=linear]').click();await page.reload();expect(await page.evaluate(()=>CircuitEvidence.load().questions['topology-psfb-scaling'].history[0].correct)).toBe(false);
 await page.getByRole('link',{name:'查看四個觀念'}).click();await expect(page.locator('[data-current-question]')).toHaveCount(4);
 await page.goto('/quiz.html?module=power-topology-control&family=buck-ripple-inductance-transfer');await expect(page.locator('[data-current-question]')).toHaveCount(4);await expect(page.locator('[data-family="buck-ripple-inductance-transfer"]')).toHaveCount(0);
});
test('direct experiment return retains prerequisite gates',async({page})=>{
 await page.goto('/index.html#experiment-feedback');await expect(page.locator('#ws-title')).toContainText('開久一點');await expect(page).toHaveURL(/#experiment-energy/);
 expect(await page.evaluate(()=>CircuitEvidence.load().benchmark.learningWorkspace?.experiment?.completed)).not.toBe(true);
});
