# C2000 Digital Buck Firmware Lab — Market Validation Runbook

This runbook exists to validate willingness to pay before adding more product scope.

## Objective

Validate whether target users will pay for a structured C2000 digital-power learning transformation:

```text
C / MCU basics
→ power-stage reasoning
→ sensing / ADC
→ PWM trigger
→ ISR / CLA timing
→ PI / C(z)
→ shadow-load actuation
→ protection / authority
→ evidence-driven debug
```

The public GitHub teaching material remains public. Paid delivery must add clearly separated value.

## Scope for v0.1

Landing page:

- `digital-buck-lab.html`
- Early Access price: NT$690
- free C2000 Buck demo remains available
- checkout is configured only through `assets/product-config.js`
- missing checkout URL fails closed

No login, membership, DRM, subscription, SaaS, or new converter topology is required for this test.

## Paid-deliverable gate

Do **not** enable checkout until the paid package exists and can be delivered immediately.

Minimum paid pack:

```text
Digital-Buck-Lab-Early-Access-v0.1/
├─ START-HERE
├─ guided-workbook
├─ timing-exercises
├─ fault-scenarios
├─ evidence-debug-checklist
└─ CHANGELOG
```

The paid pack must not contain proprietary schematic, PCB/net data, internal command payloads, calibration values, thresholds, company source code, or unsanitized measurements.

The public repository must not be presented as if it were paid-only content.

## Checkout activation

1. Create the product in Lemon Squeezy.
2. Upload the actual paid deliverable to the product.
3. Confirm product description, price, refund/contact text, and delivery.
4. Copy the real checkout URL.
5. Edit:

```js
// assets/product-config.js
checkoutUrl: "https://..."
```

6. Leave `analyticsEndpoint` blank unless a real privacy-reviewed endpoint exists.
7. Run validation.
8. Merge only after the purchase path has been manually exercised end-to-end.

The page forwards UTM parameters to the configured checkout URL.

## Validation

Required focused smoke:

```bash
npx playwright test tests/e2e/market-validation.spec.js
```

Existing regression remains authoritative:

```bash
npm test
npm run test:e2e
```

### PASS

- desktop and mobile page render
- free demo CTA resolves
- price is rendered from config
- checkout URL missing → buy CTA fails closed
- checkout URL present → buy CTA resolves to HTTP(S) checkout
- no existing learning page is replaced
- no proprietary material is added

### FAIL

Any broken CTA, misleading paid/public boundary, false engineering certification claim, or regression in existing learning flows blocks merge.

## Market experiment

The first experiment is intentionally small.

Target sample:

- 10 qualified strangers, not friends or coworkers asked to be supportive
- persona: embedded / power engineer, graduate student, or engineer moving into digital power
- they must see the same landing page and price

Record only observable behavior:

```text
qualified visitors
free-demo clicks
checkout clicks
completed payments
refunds
short reason for purchase / non-purchase if voluntarily given
```

Do not count compliments, GitHub stars, or "I would buy this" as payment evidence.

### Decision rule

- 0 / 10 paid → STOP feature work. Revisit positioning / offer / price / audience.
- 1 / 10 paid → weak signal. Interview and revise before adding scope.
- >= 2 / 10 paid → continue validation with a larger sample before expanding the product.

This is a signal threshold, not a statistically proven conversion rate.

## Stop conditions

Stop the experiment and disable checkout if:

- paid deliverable cannot be fulfilled immediately
- customer expectation differs materially from what the landing page promises
- proprietary/company IP contamination is found
- refund/support burden makes the offer incompatible with a low-maintenance side business
- users primarily want custom consulting rather than the repeatable product

## Rollback

The product surface is isolated. Roll back by reverting:

- `digital-buck-lab.html`
- `assets/market-validation.css`
- `assets/market-validation.js`
- `assets/product-config.js`
- `tests/e2e/market-validation.spec.js`
- this runbook

Existing course content and learning-state contracts are not part of the rollback.
