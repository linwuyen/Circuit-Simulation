# Circuit Simulation Learning Pack

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以 **預測 → 操作 → 獨立驗證 → 因果解釋 → 未見遷移 → 間隔取回 → 外部錨定** 為核心的電路、韌體與電力電子學習系統。

真正 KPI 不是完成頁數，而是：面對沒看過的工程條件時，第一次判斷是否正確、知道下一個該量什麼、能建立可否證的因果鏈，並在之後仍能取回與遷移。

## Power Firmware Core Path

首頁 authoritative path 是「一台 Buck、八層能力」：

```text
01 Power Physics
02 Sensing
03 Feedback
04 Timing
05 Dynamics
06 Safety
07 Production Firmware
08 Capstone / Evidence
```

Module 19 每一層都有 executable causal surface：Physics、Sensing、Feedback、Timing、Dynamics、Safety、Production，以及 Capstone/Evidence。

共同控制語言：

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

### Module roles

- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay。
- **Module 17 · Transfer Atlas** — Boost / PFC / PSFB / LLC / Inverter，含 P5 live transfer verification。
- **Module 18 · Control Grammar** — `r → e → C(z) → u → P → y` reusable reference。
- **Module 19 · Executable Capstone** — Model → Host SIL → HIL → linked F2838x Flash image → P4 physical closure / control validation → Board evidence。

詳細說明：[`docs/power-firmware-path.md`](docs/power-firmware-path.md)

## Engineering truth hierarchy

```text
Physics / teaching model
        ↓
Host SIL
        ↓
Deterministic HIL
        ↓
TI C2000 compile
        ↓
TI link + Flash .out/.map/.hex
        ↓
P4-A physical closure package
        ↓
P4-B measured control validation
        ↓
Actual board binding + physical evidence
        ↓
BOARD_PASS
```

**低層 PASS 永遠不能冒充高層 PASS。**

Required GitHub `validate` 會跑完整 Node tests、Host SIL、TI C2000 compile、Flash link/HEX、artifact upload 與 Chromium desktop/mobile smoke tests。

Flash 不猜 target probe。[`tools/flash/f2838x-uniflash.sh`](tools/flash/f2838x-uniflash.sh) 必須收到真實 exported CCXML 才會呼叫 UniFlash/DSLite；沒有 board config 就 fail closed。

## P4-A · physical board closure

`19_c2000_buck_firmware_lab/board/board-closure.template.json` 是真板 closure package 起點。

`BOARD_PASS` 前除了 linked image，還要求：

- 真實 image / CCXML / probe / flash timestamp / reset-boot observation；
- 9/9 board bindings 有 typed provenance + verified timestamp；
- 8/8 physical captures 有 acceptance、artifact ref、SHA-256、instrument、capture timestamp。

驗證 CLI：

```bash
node tools/board/verify-board-closure.mjs board-closure.json --emit-manifest board-binding-evidence.json
```

Committed template 永遠預設 `UNCLAIMED/MISSING`；CI 不會製造實板證據。

## P4-B · measured control validation

`control-validation.template.json` 把四種真實控制量測變成 machine verdict：

- load-step droop / overshoot / settling
- sample→actuate timing + strict PWM shadow-load commit
- CMPSS/Trip hardware fault-to-PWM-low latency
- measured SFRA vs model Bode magnitude/phase

```bash
node tools/board/analyze-control-validation.mjs control-validation.json
```

PASS 名稱是 `CONTROL_VALIDATION_PASS`，**不等於 `BOARD_PASS`**。

Board contract：[`19_c2000_buck_firmware_lab/board/README.md`](19_c2000_buck_firmware_lab/board/README.md)

## P4-C · real learner study

既有 PRE → POST → R1/R2/R3/R4 仍使用 V5 durable state、first attempt immutable、content-disjoint unseen cases。

Module 19 現在可以用匿名 participant ID 匯出 study JSON；`outcome-study-v1.js` 只輸出 metric，不含題目、raw answers 或自由文字。

多人資料可聚合：

```bash
node tools/learning/summarize-outcome-study.mjs p_001.outcome-study.json p_002.outcome-study.json
```

結果只代表 observational learner evidence，固定 `causalClaimAllowed: false`。

Protocol：[`docs/learning-outcome-protocol.md`](docs/learning-outcome-protocol.md)

## P5 · topology transfer

Module 17 的 P5 surface 使用同一份 `assets/learning/topology-transfer-v1.js`，把 Buck grammar 遷移到五種 topology，但要求先辨認各自 constraint：

- **Boost CCM** — RHP zero / non-minimum-phase
- **Boost PFC** — double-line energy ripple / fast-current + slow-voltage hierarchy
- **PSFB** — ZVS commutation energy margin
- **LLC** — normalized-frequency / Ln / Q operating-point dependency
- **Inverter** — LC/LCL resonance and damping

P5 有 live constraint cards 與 deterministic first-attempt unseen checks；這是 transfer-learning evidence，不是 hardware certification。

## Production / state contract

- **V3** — production renderer
- **V5** — durable learning-state schema
- **V6–V8** — measurement validity, independent verification, transfer/retention, uncertainty, external validity, typed evidence

不為版本號本身建立 V9。新 infrastructure 必須改善 unseen judgment、diagnosis、transfer、retention、target truth、measured control evidence 或 physical evidence closure。

## Public-content boundary

此 repository 只保存可公開、去產品化的通用教材。不要 commit proprietary schematic / PCB net / internal model / command payload / calibration / threshold / unsanitized measurement log。真實 board evidence 若要放進 public repo，必須先 sanitized；learner study bundle 只保留匿名 metrics。

## Validation

```bash
node tools/validate-project.mjs
npm test
npm run test:e2e
```

CI 額外執行 Host SIL、TI target compile、Flash link、HEX generation。Required `validate` 必須全綠才可 merge。

更多文件：

- [`docs/runtime-architecture.md`](docs/runtime-architecture.md)
- [`docs/verification-v7.md`](docs/verification-v7.md)
- [`docs/measurement-v8.md`](docs/measurement-v8.md)
- [`docs/power-firmware-path.md`](docs/power-firmware-path.md)
- [`docs/learning-outcome-protocol.md`](docs/learning-outcome-protocol.md)

## Maintenance stop rule

不要再為 framework 本身擴版。優先做真實 engineering scenario、fault injection、system-level transfer、target/board evidence，以及真 learner outcome data。
