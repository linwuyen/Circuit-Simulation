# Circuit Simulation Learning Pack

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

從一個問題開始：先猜、動手觀察、說出原因，再換條件試試。這套互動教材帶你從看懂開關電路，逐步進入量測與自動調整。

[進入學習工作台](index.html) · [工作台整合方式](docs/integrated-workspace.md)

首頁是連續電路實驗：沿用同一個切換電路核心，依序觀察能量、續流、負載、量測、自動控制、更新延遲、調整強度與保護。每次從相同起點重跑，保留前後設定；先猜、操作、說原因，再換成 36 V 驗證。舊八課網址與首次作答仍保留，不會自動算成新版完成。完整流程、來源與限制見[連續實驗整合](docs/continuous-workbench.md)。

接著可[沿用條件比較降壓與升壓](index.html#topology)：從手動實驗取回元件與輸入，並排計算既有 CCM 模型，保留預測、觀察、原因與返回降壓的判斷。完整拓樸教材可明確套用同一份設定；固定練習不授予正式測驗成績。範圍與回退方式見[跨電路整合](docs/topology-workbench.md)。

教學設計、進度相容方式與真人試用方法見[一步一步學](docs/plain-guided-learning.md)。

## Power Firmware Core Path

完成入門後，可從進階教材選擇「一台 Buck、八層能力」：

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

所有 Guided layer 都收斂到同一個工程迴圈：

```text
白話物理問題
→ 方向預測
→ 只改一個變數
→ 觀察
→ 因果解釋 + 假設邊界
→ 真板下一個最高資訊量量測
```

共同控制語言：

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

Module 19 同時固定使用五個工程視圖：**PHYSICAL / SIGNAL / CONTROL / TIME / AUTHORITY**。目的不是增加新章節，而是讓學員遇到任何症狀時先定位是哪個 contract 壞掉，再決定是否要改 code。

### Module roles

- **Module 15 · Debug Challenge Bank** — 完成 Module 19 的正常因果鏈後，進行 unknown-system fault isolation；它不是第二個 capstone。
- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay。
- **Module 17 · Transfer Atlas** — Boost / PFC / PSFB / LLC / Inverter，含 P5 live transfer verification。
- **Module 18 · Control Grammar** — `r → e → C(z) → u → P → y` reusable reference。
- **Module 19 · Executable Capstone** — authoritative Model → Host SIL → HIL → linked F2838x Flash image → P4 physical closure / control validation → Board evidence。

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

Software PWM grant 不是單一 `enable` bit：

```text
PWM_AUTHORITY =
    RUN
 && command_fresh
 && sensing_valid
 && no_fault
 && peripherals_ready
 && calibration_valid
```

而且即使 software authority 成立，CMPSS / Trip Zone 仍可獨立 hardware veto。Command freshness 只由外部 producer publication 更新，consumer/ADC ISR 不得替 producer 製造 heartbeat。

- **V3** — production renderer
- **V5** — durable learning-state schema
- **V6–V8** — measurement validity, independent verification, transfer/retention, uncertainty, external validity, typed evidence

不為版本號本身建立 V9。新 infrastructure 必須改善 unseen judgment、diagnosis、transfer、retention、target truth、measured control evidence 或 physical evidence closure。

## Public-content boundary

此 repository 只保存可公開、去產品化的通用教材。不要 commit proprietary schematic / PCB net / internal model / command payload / calibration / threshold / unsanitized measurement log。真實 board evidence 若要放進 public repo，必須先 sanitized；learner study bundle 只保留匿名 metrics。

## 實作訓練擴充

Module 15 現在提供 [CCM/DCM 與量測重播](15_power_capstone/lab_sandbox.html#training-workbench)、[盲測維修與新工況驗證](15_power_capstone/lab_multifault.html#repair-training)，以及四類錯題短實驗。
完整備份包含八層主線進度；匿名試用統計由學員自願下載，不自動上傳。
模型邊界、重播格式與真人試用流程見 [實作訓練文件](docs/training-lab.md)。

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

### 初學者：五堂電路基礎，再接三堂自動調整

[入門模式](15_power_capstone/learn_basics.html)提供導通比例、電感續流、輕載邊界、量測倍率與更新時刻五個短任務。先猜、單一變因操作、分段提示，再以新條件確認理解；電路路徑與波形可同步播放或單步查看。能力紀錄為本機練習狀態，沿用完整備份，不代表實體操作認證。


### 整合學習入口

[能力總覽與繼續學習](map.html)整合入門、八層主線、補強往返、既有題庫與正式間隔複習。[同一案例實驗](learning-case.html)可在電路、量測、時序與控制視圖間切換，並與相容的進階 Buck 模型共用設定。詳見[整合與模型界線](docs/integrated-learning.md)。
