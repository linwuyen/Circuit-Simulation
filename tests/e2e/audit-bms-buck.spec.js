const {test,expect}=require('@playwright/test');
test('BMS faults veto before discharge and keyboard changes comparison cells',async({page})=>{
 await page.goto('/7.28388d_bms_tutorial/04_decide.html');
 await page.locator('#fsm-current-slider').fill('151');await page.locator('#fsm-current-slider').dispatchEvent('input');
 await expect(page.locator('#system-state')).toContainText('FAULT_LOCK');await expect(page.locator('#contactor')).toContainText('OPEN');
 await page.locator('#fsm-reset').click();await page.locator('#fsm-request').click();
 await expect(page.locator('#system-state')).toContainText('FAULT_LOCK');
 await page.goto('/7.28388d_bms_tutorial/03_compare.html');
 const cell=page.locator('#cmp-cell-0');await cell.focus();await page.keyboard.press('Enter');await expect(cell).toHaveText('4.35');
 const ntc=page.locator('#cmp-ntc-0');await ntc.focus();await page.keyboard.press('Space');await expect(ntc).toHaveText('65°');
});
test('Buck invalid point clears stale evidence, restores valid point without duty clipping',async({page})=>{
 await page.goto('/0_buck_converter_/buck_converter_ripple_simulator.html');
 for(const [id,value] of [['vin','10'],['vout','12']]){await page.locator('#'+id).fill(value);await page.locator('#'+id).dispatchEvent('input');}
 await expect(page.locator('#modeLine')).toContainText('條件不成立');await expect(page.locator('#dutyVal')).toHaveText('—');await expect(page.locator('#scopeSvg')).toBeEmpty();
 await page.locator('#vout').fill('9.8');await page.locator('#vout').dispatchEvent('input');
 await expect(page.locator('#modeLine')).not.toContainText('條件不成立');
 expect(parseFloat(await page.locator('#dutyVal').textContent())).toBeGreaterThan(98);
 await expect(page.locator('#scopeSvg')).not.toBeEmpty();
});
