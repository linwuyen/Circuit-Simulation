const { test, expect } = require('@playwright/test');

async function fresh(page){
  await page.goto('/learn.html#ti-concepts/buck-energy-flow');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/learn.html#ti-concepts/buck-energy-flow');
  await expect(page.locator('#ti-concept-nav button')).toHaveCount(15);
}

async function answer(page,value){
  await page.locator(`input[name="ti-concept-answer"][value="${value}"]`).check();
  await page.getByRole('button',{name:'Commit answer'}).click();
}

test('generic TI concept lab closes predict diagnose transfer and schedules 30-day review',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fresh(page);

  await expect(page.locator('#ws-title')).toContainText('Buck energy flow');
  await answer(page,'time');
  await answer(page,'measure');
  await answer(page,'path');

  await expect(page.locator('.ti-grade')).toContainText('TRANSFER');
  const result=await page.evaluate(()=>{
    const r=CircuitEvidence.load().benchmark.tiConceptLabs['buck-energy-flow'];
    const a=new Date(r.lastReviewed+'T12:00:00'),b=new Date(r.nextReview+'T12:00:00');
    return {completed:r.completed,grade:r.grade,days:Math.round((b-a)/86400000),first:r.session.attempts.predict.firstAnswer};
  });
  expect(result).toEqual({completed:true,grade:'transfer',days:30,first:'time'});

  await page.reload();
  await expect(page.locator('.ti-grade')).toContainText('TRANSFER');

  await page.getByRole('button',{name:/Boost CCM right-half-plane zero/}).click();
  await expect(page.locator('#ws-title')).toContainText('Boost CCM');
  await expect(page.locator('#ws-question')).not.toContainText('Prerequisite locked');

  const pi=page.getByRole('button',{name:/PI zero placement/});
  await expect(pi).toBeDisabled();
  expect(errors).toEqual([]);
});

test('source-evidence concepts do not claim a fake simulator',async({page})=>{
  await fresh(page);
  await page.evaluate(()=>{
    const s=CircuitEvidence.load();
    s.benchmark.tiConceptLabs={'buck-energy-flow':{completed:true,session:{completed:true,attempts:{},id:1}}};
    CircuitEvidence.save(s);
  });
  await page.goto('/learn.html#ti-concepts/current-mode-slope-comp');
  await expect(page.locator('#ws-comparison')).toContainText('no fake executable simulator');
  await expect(page.locator('.ti-concept-sources a')).toHaveCount(5);
});

test('all 15 TI concept routes render after prerequisites are satisfied',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fresh(page);
  const ids=await page.evaluate(async()=>{
    const cards=await fetch('learning/ti/concept-cards.json').then(r=>r.json());
    const s=CircuitEvidence.load();s.benchmark.tiConceptLabs={};
    for(const c of cards.cards)s.benchmark.tiConceptLabs[c.id]={completed:true,grade:'pass',session:{id:1,completed:true,attempts:{predict:{passed:true},diagnose:{passed:true},transfer:{passed:true}}}};
    CircuitEvidence.save(s);
    return cards.cards.map(c=>c.id);
  });
  expect(ids).toHaveLength(15);
  for(const id of ids){
    await page.goto('/learn.html#ti-concepts/'+encodeURIComponent(id));
    await expect(page.locator('#ws-title')).not.toBeEmpty();
    await expect(page.locator('.ti-concept-card')).toHaveCount(4);
  }
  expect(errors).toEqual([]);
});
