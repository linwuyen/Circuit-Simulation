# Circuit Simulation Learning Pack

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以 **預測 → 操作 → 獨立驗證 → 因果解釋 → 未見遷移 → 間隔取回 → 外部錨定** 為核心的電路、韌體與電力電子學習系統。

真正 KPI 不是完成頁數，而是：面對沒看過的工程條件時，第一次判斷是否正確、知道下一個該量什麼、能建立可否證的因果鏈，並在之後仍能取回與遷移。

## Power Firmware Core Path

首頁的 authoritative learning path 是「一台 Buck、八層能力」：

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

共同控制語言：

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

學習循環：

```text
Problem
→ Prediction
→ Experiment
→ Observation
→ Mechanism
→ Firmware Mapping
→ Fault Injection
→ Next Measurement
→ Unseen Transfer
```

完整主題仍保留為索引，但不代表建議學習順序。

### Module roles

- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay。
- **Module 17 · Transfer Atlas** — Boost / PFC / PSFB / LLC / Inverter。
- **Module 18 · Control Grammar** — `r → e → C(z) → u → P → y` reusable reference。
- **Module 19 · Executable Capstone** — Model → Host SIL → HIL → F2838x target → Board evidence。

詳細說明：[`docs/power-firmware-path.md`](docs/power-firmware-path.md)

## Truth hierarchy

```text
Physics / teaching model
        ↓
Independent model checks
        ↓
Host SIL
        ↓
Deterministic HIL
        ↓
TI C2000 target compile
        ↓
Actual board binding
        ↓
Physical board evidence
```

**低層 PASS 永遠不能冒充高層 PASS。**

GitHub `validate` 會：

- 驗 links / curriculum / JavaScript
- 跑完整 Node engineering + learning tests
- GCC 編譯並執行 Host SIL
- 用 **TI C2000 CGT 25.11.1.LTS** + **C2000Ware 26.01.00.00.STS** 真正 compile F2838x CPU1 target objects
- 跑 Chromium desktop/mobile Playwright smoke tests

Module 19 的 board manifest 預設為 `UNCLAIMED`。沒有實際 board binding 與八項 physical evidence，不得標 `BOARD_PASS`。

Board contract：[`19_c2000_buck_firmware_lab/board/README.md`](19_c2000_buck_firmware_lab/board/README.md)

## Learning outcome measurement

課程成效用 unseen benchmark，而不是「看過幾頁」衡量：

- First-attempt accuracy
- Next-measurement accuracy
- Unseen-transfer accuracy
- Pre/post change by competency
- 1d / 7d / 30d / 90d retention

Retry 不會洗掉第一次答錯；pre/post 使用不同 seeded variants。測到 improvement 只代表 learner evidence，不自動宣稱課程具有因果效果。

Protocol：[`docs/learning-outcome-protocol.md`](docs/learning-outcome-protocol.md)

## Engineering Capability Ladder

- **L0 Recognize** — 辨認元件、訊號與狀態
- **L1 Calculate** — 算量級與 unit
- **L2 Predict** — 操作前預測方向
- **L3 Measure** — 選下一個最有資訊量的 measurement
- **L4 Diagnose** — 由 evidence 收斂 root cause
- **L5 Design** — 由 requirement 反推 design contract
- **L6 Integrate** — 串 sensing / control / protection / communication
- **L7 Debug unknown system** — 面對未知系統仍能逐層證偽

## Production / state contract

- **V3** — production renderer
- **V5** — durable learning-state schema (`circuit-learning-state-v5`)
- **V6–V8** — measurement validity, independent verification, transfer/retention, uncertainty, external validity, typed evidence

不為版本號本身建立 V9。新 infrastructure 必須改善 unseen judgment、diagnosis、transfer、retention、target truth 或 physical evidence closure。

## Evidence semantics

強 evidence 必須遵守：

```text
Prediction Commit
      ↓
first simulator event
      ↓
Observation / independent verification
```

Strength 與 learning stage 分離：

| Strength | 意義 |
|---|---|
| C | human-only 或 post-hoc evidence |
| B | preregistered Prediction + machine interaction + reasoning pass |
| A | preregistered Prediction + independent oracle PASS + domain gate |

A / external anchor 都 **不等於 hardware certification**。

## Public-content boundary

此 repository 只保存可公開、去產品化的通用教材。

不要放進 public Git history：

- 公司產品名稱、內部型號、客戶規格
- proprietary schematic / PCB net / pin map
- proprietary command / protocol payload
- firmware snapshot / internal memory map
- internal threshold / calibration / control coefficients
- 公司量測紀錄或未公開設計資料

允許公開的是抽象後可遷移的 engineering pattern：sampling/actuation timing、scale/offset/unit chain、protection latency、state invariant、producer/consumer ownership、control-loop reasoning、fault isolation、sanitized evidence contract。

## Validation

```bash
node tools/validate-project.mjs
npm test
npm run test:e2e
```

CI 額外執行 Host SIL 與 TI C2000 target compile。Required `validate` 必須全綠才可 merge。

更多架構文件：

- [`docs/runtime-architecture.md`](docs/runtime-architecture.md)
- [`docs/verification-v7.md`](docs/verification-v7.md)
- [`docs/measurement-v8.md`](docs/measurement-v8.md)
- [`docs/power-firmware-path.md`](docs/power-firmware-path.md)

## Maintenance stop rule

不要再為框架本身擴版。優先新增：real engineering scenario、fault injection、waveform/timing reasoning、system-level transfer、target build truth、board evidence，以及真正能測量 learner outcome 的 benchmark。
