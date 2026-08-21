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

Module 19 現在每一層都有 executable causal surface：

- Physics — switching-cycle / volt-second / ΔiL
- Sensing — sample phase / divider / ADC quantization / reconstruction
- Feedback — discrete PI + averaged Buck response
- Timing — SOCA → ADC → ISR → shadow write → physical PWM load
- Dynamics — ideal LC duty-to-output plant + pure delay phase
- Safety — parameterized hardware-veto vs software-path latency
- Production — command age / strict timeout / fail-closed state
- Capstone / Transfer — Boost CCM RHP zero + unseen benchmark / next measurement

共同控制語言：

```text
r → e → C(z) → u → P(s) → y
                    ↑        ↓
             Sensor / ADC feedback

Safety veto: CMPSS / Trip / State → PWM OFF
```

完整主題仍保留為索引，但不代表建議學習順序。

### Module roles

- **Module 16 · Math Lens** — Laplace / Fourier / Z / Bode / delay。
- **Module 17 · Transfer Atlas** — Boost / PFC / PSFB / LLC / Inverter。
- **Module 18 · Control Grammar** — `r → e → C(z) → u → P → y` reusable reference。
- **Module 19 · Executable Capstone** — Model → Host SIL → HIL → linked F2838x Flash image → Board evidence。

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
Actual board binding
        ↓
Physical board evidence
```

**低層 PASS 永遠不能冒充高層 PASS。**

Required GitHub `validate` 會：

- 驗 links / curriculum / JavaScript
- 跑完整 Node engineering + learning tests
- GCC 編譯並執行 Host SIL
- 安裝 **TI C2000 CGT 25.11.1.LTS**
- checkout **C2000Ware 26.01.00.00.STS**
- 真正 compile `buck_control.c` / `f2838x_target.c`
- 再加入 `device.c`、`f2838x_codestartbranch.asm`、官方 `2838x_FLASH_lnk_cpu1.cmd` 與 `driverlib.lib` link Flash image
- 產生並驗證 `c2000-buck-f2838x.out` / `.map` / Intel `.hex`
- 把 image 上傳成 CI artifact
- 跑 Chromium desktop/mobile Playwright smoke tests

Flash 不猜 target probe。[`tools/flash/f2838x-uniflash.sh`](tools/flash/f2838x-uniflash.sh) 必須收到真實 exported CCXML，才會呼叫 UniFlash/DSLite；沒有 board config 就 fail closed。

## Board truth contract

`19_c2000_buck_firmware_lab/board/board-binding.reference.json` 預設為 `UNCLAIMED`。

`BOARD_PASS` 同時要求：

1. linked target image PASS；
2. 9/9 board-specific bindings `VERIFIED` 並有 source；
3. 8/8 physical evidence `PASS` 並有 artifact。

Module 19 Board UI 直接讀 machine-readable manifest，不再用任意 checkbox 冒充 scope evidence。使用者可以載入 sanitized local manifest 驗證 claim；瀏覽器或 CI 都不能生成 physical PASS。

Board contract：[`19_c2000_buck_firmware_lab/board/README.md`](19_c2000_buck_firmware_lab/board/README.md)

## Learning outcome measurement

課程成效用 content-disjoint unseen benchmark，而不是「看過幾頁」衡量：

- First-attempt accuracy
- Next-measurement accuracy
- Unseen-transfer accuracy
- Pre/post change
- R1/R2/R3/R4 = 1/7/30/90 day retention

`assets/learning/outcome-session-v1.js` 已把 benchmark 接進 **V5 durable state (`circuit-learning-state-v5`)**：

- first attempt immutable；retry 只另記，不洗分
- PRE 完成後才有有效 POST 配對
- POST 完成後產生 retention due dates
- Module 19 顯示完整 benchmark flow
- 首頁顯示真實 PRE / POST / Δ / next-measurement / transfer / next retention due
- 沒有 learner attempts 就顯示空值；CI 不會用 synthetic perfect score 冒充真人成效

測到 improvement 只代表 learner evidence，不自動宣稱課程具有因果效果。

Protocol：[`docs/learning-outcome-protocol.md`](docs/learning-outcome-protocol.md)

## Production / state contract

- **V3** — production renderer
- **V5** — durable learning-state schema
- **V6–V8** — measurement validity, independent verification, transfer/retention, uncertainty, external validity, typed evidence

不為版本號本身建立 V9。新 infrastructure 必須改善 unseen judgment、diagnosis、transfer、retention、target truth 或 physical evidence closure。

## Public-content boundary

此 repository 只保存可公開、去產品化的通用教材。不要 commit proprietary schematic / PCB net / internal model / command payload / calibration / threshold / measurement log。真實 board evidence 若要放進 public repo，必須先 sanitized。

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
