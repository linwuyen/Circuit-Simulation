const { test, expect } = require("@playwright/test");

test("Module 17 equation-grade plants render and react without page errors", async ({ page }) => {
  const errors=[];
  page.on("pageerror",error=>errors.push(String(error)));
  await page.goto("/17_power_topology_control/");

  await expect(page).toHaveTitle(/Power Topology Control Atlas/);
  await expect(page.locator("canvas")).toHaveCount(7);
  await expect(page.locator("#boostBode")).toBeVisible();
  await expect(page.locator("#pfcCurrentBode")).toBeVisible();
  await expect(page.locator("#pfcVoltageBode")).toBeVisible();
  await expect(page.locator("#psfbBode")).toBeVisible();
  await expect(page.locator("#llcGainCanvas")).toBeVisible();
  await expect(page.locator("#invBode")).toBeVisible();

  const rhpBefore=await page.locator("#boostRhpz").textContent();
  await page.locator("#dutyBoost").fill("75");
  await expect(page.locator("#boostRhpz")).not.toHaveText(rhpBefore);
  await expect(page.locator("#boostQ")).not.toHaveText("");

  await expect(page.locator("#pfcOuterPole")).toContainText("Hz");
  await page.locator("#pfcC").fill("1200");
  await expect(page.locator("#pfcOuterPole")).toContainText("Hz");

  await expect(page.locator("#psfbF0")).toContainText("Hz");
  await page.locator("#psfbLo").fill("300");
  await expect(page.locator("#psfbF0")).toContainText("Hz");

  await expect(page.locator("#llcSlope")).not.toHaveText("");
  await page.locator("#llcFs").fill("180");
  await expect(page.locator("#llcExplain")).toContainText("dlnM/dlnf");
  await expect(page.locator("#llcExplain")).toContainText("不是 dynamic loop phase");

  await expect(page.locator("#invModeText")).toHaveText("Standalone LC");
  await page.locator("#invMode").selectOption("lcl");
  await expect(page.locator("#invModeText")).toHaveText("Grid-tied LCL");
  await expect(page.locator("#invDebug")).toContainText("damping");

  await expect(page.locator("body")).toContainText("Equation-grade");
  await expect(page.locator("body")).toContainText("Hardware evidence");
  expect(errors).toEqual([]);
});
