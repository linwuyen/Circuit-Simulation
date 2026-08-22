const { test, expect } = require("@playwright/test");

test("power topology control atlas connects six power stages to control models", async ({ page }) => {
  await page.goto("/17_power_topology_control/index.html");
  await expect(page.getByRole("heading", { name: /同一套控制語言/ })).toBeVisible();
  await expect(page.getByText(/FIDELITY BEFORE PRETTY CURVES/)).toBeVisible();
  await expect(page.locator("#buckVout")).toHaveText("24.00 V");
  await expect(page.locator("#buckF0")).toContainText("Hz");

  await page.locator("#dutyBuck").evaluate(el => { el.value = "25"; el.dispatchEvent(new Event("input", { bubbles: true })); });
  await expect(page.locator("#buckVout")).toHaveText("12.00 V");

  // Equation-grade Boost contract: expose the physical LC pole and RHP zero.
  // Do not resurrect the old fc/10 heuristic that the fidelity redesign removed.
  await expect(page.locator("#boostRhpz")).toContainText("kHz");
  await expect(page.locator("#boostF0")).toContainText("Hz");
  await expect(page.locator("#boostQ")).not.toHaveText("");

  // PFC keeps the forced 2ω disturbance separate from the outer energy-plant pole.
  await expect(page.locator("#pfcRippleHz")).toHaveText("120 Hz");
  await expect(page.locator("#pfcOuterPole")).toContainText("Hz");

  await expect(page.locator("#psfbM")).toHaveText("0.500");
  await expect(page.locator("#psfbZvs")).toContainText("×");
  await expect(page.locator("#llcFr")).toContainText("kHz");
  await expect(page.locator("#llcGain")).not.toHaveText("");

  await expect(page.locator("#invModeText")).toHaveText("Standalone LC");
  await page.locator("#invMode").selectOption("lcl");
  await expect(page.locator("#invModeText")).toHaveText("Grid-tied LCL");
  await expect(page.locator("#invDebug")).toContainText("LCL resonance");

  await expect(page.locator("#workflow")).toContainText("POWER STAGE");
  await expect(page.locator("#workflow")).toContainText("SFRA");
});
