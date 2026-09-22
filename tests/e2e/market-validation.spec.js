const { test, expect } = require("@playwright/test");

test.describe("digital buck market-validation page", () => {
  test("renders the offer and keeps checkout fail-closed until configured", async ({ page }) => {
    await page.goto("/digital-buck-lab.html");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("ADC");
    await expect(page.getByText("NT$690").first()).toBeVisible();

    const demo = page.getByRole("link", { name: /免費 C2000 Buck Demo/ });
    await expect(demo).toHaveAttribute("href", "19_c2000_buck_firmware_lab/index.html");

    const checkoutUrl = await page.evaluate(() => window.DIGITAL_BUCK_PRODUCT.checkoutUrl);
    const buy = page.locator("[data-buy]").first();

    if (checkoutUrl) {
      await expect(buy).toHaveAttribute("href", /^https?:\/\//);
      await expect(buy).not.toHaveAttribute("aria-disabled", "true");
    } else {
      await expect(buy).toHaveAttribute("aria-disabled", "true");
      await expect(buy).not.toHaveAttribute("href", /https?:\/\//);
    }
  });

  test("mobile layout keeps the primary actions visible", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile project only");
    await page.goto("/digital-buck-lab.html");

    await expect(page.locator("[data-buy]").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /免費 C2000 Buck Demo/ })).toBeVisible();
  });
});
