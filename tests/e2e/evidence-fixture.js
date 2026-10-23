const { expect } = require('@playwright/test');

// Fixture writes are asynchronous in browsers. Never navigate or inspect another
// tab until the evidence owner confirms the lock-protected commit completed.
async function flushEvidence(page) {
  await page.waitForFunction(() => !!window.CircuitEvidence);
  const status = await page.evaluate(() => CircuitEvidence.flush());
  expect(status.saved, `Fixture evidence not committed: ${status.reason}`).toBe(true);
}

async function resetEvidence(page) {
  await flushEvidence(page);
  const reset = await page.evaluate(async () => {
    const cleared = await CircuitEvidence._resetForTests();
    if (cleared !== true) return { cleared, status: CircuitEvidence.storageStatus() };
    // Primary/migration evidence keys belong exclusively to _resetForTests.
    // Clear only auxiliary fixture state; localStorage.clear() would race the
    // evidence baseline and can manufacture a cross-tab conflict on reload.
    for (const key of Object.keys(localStorage)) {
      if (!/^circuit-learning-state-v[2-5]$/.test(key)) localStorage.removeItem(key);
    }
    return { cleared, status: CircuitEvidence.storageStatus() };
  });
  expect(reset.cleared, `Fixture reset refused: ${reset.status.reason}`).toBe(true);
  expect(reset.status.saved).toBe(true);
}

module.exports = { flushEvidence, resetEvidence };
