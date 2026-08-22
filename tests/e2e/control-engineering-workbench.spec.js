const {test,expect}=require("@playwright/test");

test("Module 18 exposes a direct Engineering Workbench entry",async({page})=>{
  await page.goto("/18_control_unification/index.html");
  const entry=page.getByRole("link",{name:/Open Digital Power Engineering Workbench/});
  await expect(entry).toBeVisible();
  await expect(entry).toHaveAttribute("href","engineering-workbench.html");
  await entry.click();
  await expect(page).toHaveURL(/18_control_unification\/engineering-workbench\.html$/);
  await expect(page.getByRole("heading",{name:/plant → loop → timing → code → measurement/})).toBeVisible();
});

test("engineering workbench closes model to code to evidence flow",async({page})=>{
  await page.goto("/18_control_unification/engineering-workbench.html");
  await expect(page.getByRole("heading",{name:/plant → loop → timing → code → measurement/})).toBeVisible();
  // The badge is intentionally hidden on narrow mobile layouts; its contract text must still exist in the DOM.
  await expect(page.locator(".topbar .badge")).toHaveText("MODEL → CODE → EVIDENCE");
  await expect(page.locator("#loopStatus")).not.toHaveText("CALCULATING");
  await expect(page.locator("#kp")).not.toHaveText("—");
  await expect(page.locator("#b0")).not.toHaveText("—");
  await expect(page.locator("#cCode")).toContainText("verify scaling, saturation and anti-windup on target");

  const phaseBefore=await page.locator("#timingPhase").textContent();
  await page.locator("#computeCycles").fill("2200");
  await page.locator("#computeCycles").dispatchEvent("input");
  await expect(page.locator("#timingStatus")).toHaveText("LOAD MISSED");
  expect(Number(await page.locator("#missed").textContent())).toBeGreaterThan(0);
  await page.locator("#fc").evaluate(el=>{el.value="1000";el.dispatchEvent(new Event("input",{bubbles:true}));});
  await expect(page.locator("#timingPhase")).not.toHaveText(phaseBefore);

  await expect(page.locator("#envelopeBody")).toContainText("RHPZ");
  await expect(page.locator("#envelopeBody")).toContainText("CCM");

  await page.locator("#demoCsv").click();
  await page.locator("#correlate").click();
  await expect(page.locator("#claimState")).toHaveText("CORRELATED");
  await expect(page.locator("#evidenceState")).toHaveText("UNVERIFIED_IMPORT");
  await page.locator("#sourceType").fill("SFRA");
  await page.locator("#instrument").fill("F2838x SFRA");
  await page.locator("#boardId").fill("board-A");
  await page.locator("#capturedAt").fill("2026-08-23");
  await page.locator("#correlate").click();
  await expect(page.locator("#evidenceState")).toHaveText("PROVENANCE_BOUND");

  await page.getByRole("button",{name:/LLC FHA/}).click();
  await expect(page.locator("#breakStatus")).toHaveText("BOUNDARY VIOLATED");
  await expect(page.locator("#breakResult")).toContainText("FHA");
  await expect(page.locator("#questionText")).not.toHaveText("—");
  await expect(page.locator("#contractEquation")).not.toHaveText("—");
  await expect(page.locator("#contractUnits")).not.toHaveText("—");
});

test("engineering workbench has no horizontal overflow on desktop or mobile",async({page})=>{
  for(const viewport of[{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);
    await page.goto("/18_control_unification/engineering-workbench.html");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
