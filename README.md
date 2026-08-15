# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「**預測 → 操作 → 獨立驗證 → 因果解釋 → 未見遷移 → 間隔取回 → 外部錨定**」為核心的電路、韌體與電力電子學習系統。

真正 KPI 不是完成頁數，而是：面對沒看過的工程條件時，**第一次判斷是否正確、知道下一個該量什麼、能否建立可否證的因果鏈、證據是否可獨立驗證，以及隔一段時間後是否仍能取回並遷移到新情境**。

## 公開內容界線

此 repository 只保存可公開、去產品化的通用教材。

**禁止進入 public Git history：**

- 公司產品名稱、內部型號、客戶規格
- schematic、PCB net name、pin map
- proprietary command / protocol payload
- firmware snapshot、memory/register map
- internal threshold、calibration constant、control coefficient
- 公司量測紀錄、未公開設計資料

**允許公開：**經過抽象化後可遷移的 engineering pattern，例如 sampling/actuation timing、scale/offset/unit chain、protection latency、state invariant、producer/consumer ownership、control-loop reasoning、fault isolation 與 debug methodology。

## Production truth

- **V3**：唯一 production renderer。
- **V5**：唯一 durable learning-state schema，key 為 `circuit-learning-state-v5`。
- **V6**：measurement-validity semantics；independent oracle、deterministic reasoning、true transfer、uncertainty、Bayesian diagnosis。
- **V7**：lab verification closure。
- **V8**：external validity + real engineering transfer；typed observables、mutation FDR、competency graph 與 evidence-based adaptive sequencing。
- **OP AMP extension**：在同一框架加入第 13 模組，不建立 V9。
- **Power Electronics Firmware Engineer Path**：在同一 V3/V5/V8 contract 上加入 PWM/ADC Sync、Protection、Generic Capstone，將零散 module 收斂成職業能力主線；仍不建立 V9。

### Current production

- **16 modules**
- **50 classified labs**
- **16 modules with an A-capable independent path**
- **21 seeded numeric task families**
- **14 Bayesian diagnostic cases**
- **16 external reality anchors**
- **16 representative mutation paths**

V6/V7/V8 與後續內容擴充都沒有另造 persistence schema；沒有真實 schema incompatibility 就不為版本號本身製造 migration cost。

詳細文件：

- [`docs/runtime-architecture.md`](docs/runtime-architecture.md)
- [`docs/verification-v7.md`](docs/verification-v7.md)
- [`docs/measurement-v8.md`](docs/measurement-v8.md)
- [`docs/opamp-slew-rate.md`](docs/opamp-slew-rate.md)
- [`docs/power-firmware-path.md`](docs/power-firmware-path.md)

## Power Electronics Firmware Engineer Path

首頁將課程整理成六層能力主線，而不是單純列 module：

```text
1. Power Physics
      ↓
2. Sensing
      ↓
3. Timing & Control
      ↓
4. Protection & State
      ↓
5. Communication & Actuation
      ↓
6. System Integration
```

對應的工程因果鏈是：

```text
Requirement
   ↓
Power Stage
   ↓
Sensing / Scaling
   ↓
ADC Sampling
   ↓
Control Law
   ↓
PWM / Actuation
   ↓
Protection / State
   ↓
Communication / Data Ownership
   ↓
Observation / Diagnosis
```

### Engineering Capability Ladder

Progress page另外顯示 L0–L7：

- **L0 Recognize**：辨認元件、訊號與狀態
- **L1 Calculate**：算出量級與 unit
- **L2 Predict**：操作前能預測方向
- **L3 Measure**：知道下一個最有資訊量的 measurement
- **L4 Diagnose**：由 evidence 收斂 root cause
- **L5 Design**：由 requirement 反推 design contract
- **L6 Integrate**：串起 sensing / control / protection / communication
- **L7 Debug unknown system**：面對沒看過的系統仍能逐層證偽

最高目標不是背公式，而是未知情境中的 first-attempt engineering judgment。

## 16 Modules

既有主題：

- Buck
- ADC / measurement scaling
- Inverter
- FOC
- PI
- SPI
- 10 µs real-time loop
- BMS
- AD5543 DAC
- AFE
- ACMC Pro
- C2000 DDS
- OP AMP Slew Rate / Dynamic Response

新增三個 system-level module：

### PWM → ADC → ISR Synchronization

核心 competency：`power-sync.sample-update.deadline`

訓練：

- PWM event → ADC SOC
- acquisition / conversion latency
- ISR / control deadline
- switching-edge sample placement
- PWM shadow load / one-cycle delay

A-capable lab：`power-sync.lab.timing`

Independent oracle 重新計算 period、sample instant、data-ready、control-done 與 same-cycle margin；A acceptance 要求 margin ≥ 1 µs。

### Power Protection Architecture

核心 competency：`protection.trip.latency`

訓練：

- comparator/filter/trip hardware path
- ADC/ISR software protection path
- filter / blanking latency tradeoff
- fault latch / explicit re-arm
- fail-closed startup sequence

A-capable lab：`protection.lab.trip-latency`

Independent oracle 分別累加 hardware 與 software serial path；A acceptance 要求 hardware path ≤ 1 µs 且快於 software path。

### Programmable Power Converter Capstone

核心 competency：`capstone.signal-chain.integration`

這是一個**完全 generic** 的 power converter system，不對應任何公司產品。

訓練：

- requirement → command → control → PWM → plant → sensor → ADC signal chain
- serial critical-path budget
- background communication isolation
- sensing / control / stale-data fault isolation
- Power → Clock → Reset → Signal → Timing → Data → State → Control → Plant debug ladder

A-capable lab：`power-capstone.lab.integration-budget`

Independent oracle 只計算 serial sensing → control → PWM-commit critical path；A acceptance 要求 deterministic margin ≥ 2 µs。

## Evidence semantics

強 evidence 的第一個要求是 Prediction 真正在看到結果之前發生：

```text
Prediction Commit
      ↓
first simulator event
      ↓
Observation / independent verification
```

第一版 Prediction 以 immutable revision 保存。先操作 simulator 再補 Prediction 會明確標為 post-hoc。

### Strength 與 Stage 分離

| Strength | 意義 |
|---|---|
| C | human-only 或 post-hoc evidence |
| B | preregistered Prediction + machine interaction + reasoning pass |
| A | preregistered Prediction + independent oracle PASS + domain reasoning gate |

Stage 仍是 Viewed → Practiced → Verified → Retained；Stage 與 Strength 是不同維度。

**A 不等於 hardware certification。** A 只代表對公開教材/模型 contract 的獨立驗證。

## Independent verification

16 個模組各保留至少一條 A-capable path，使用可審查的方法：

1. **Registry ↔ independent reference**：production model 與 reference executable path 分離。
2. **Black-box page-output comparison**：獨立解析式驗頁面實際輸出。
3. **State invariant**：安全/狀態機問題不硬造數值 oracle。

沒有單一可辯護 ground truth 的 waveform diagnosis、open-ended tuning、procedural checklist、fault isolation strategy 等任務明確停在 **ceiling B**，不以假 oracle 充數。

## Deterministic engineering reasoning

工作單不因文字夠長就算工程推理。核心 rubric：

1. Claim
2. Evidence
3. Mechanism
4. Boundary
5. Transfer

總分至少 8/10，且 Claim / Evidence / Mechanism 為必要項。A-capable lab 再加 domain-specific fail-closed gate；流暢但無物理/時序因果的 filler text 不能取得 A。

## True Transfer / Retention

正式 competency family 使用：

```text
Baseline A
   ↓
seeded unseen Transfer
   ↓
R1 1d → R2 7d → R3 30d → R4 90d
```

Transfer 不只換 prompt；generator 保存 `seed`、`transferDepth`、`representation`、`parameters`，且真的改變工程條件和/或表示方式。

答錯的 first-attempt variant 不能靠重試洗成 transfer pass，必須換下一個 unseen variant。

三個新 power-firmware family 各具有 baseline + 3 unseen transfer + R1/R2/R3/R4。

## Open-response：Recognition → Generation

Current production 有 **21** 個 seeded numeric task family。

Power firmware path 新增：

- `sync-open-margin`
- `sync-open-period`
- `protection-open-hw-latency`
- `protection-open-speedup`
- `capstone-open-margin`
- `capstone-open-critical`

每次答案保存 seed、parameters、unit、expected value、relative error 與 attempt history。

## Bayesian Diagnostic Reasoning

Current production 有 **14** 個 diagnostic case。

Power firmware path 新增：

- `sync-deadline-game`：fsw 提高後 stale duty / missed load deadline
- `protection-path-game`：software flag 正確但 fault-to-PWM-off 太慢
- `capstone-chain-game`：scale / control / stale-command system fault isolation

每個 measurement 都有 `P(result | cause)`；系統以 Bayes update 更新 posterior，再用 Shannon entropy reduction 計算 information gain。

目標不是猜 root cause，而是訓練「下一個量什麼最能縮小 hypothesis space」。

## External Reality Anchors

系統使用第三條 truth source：

```text
Teaching model
      ↓
Independent oracle
      ↓
External source + golden vector
```

16/16 modules 都有明確 scope 的 external anchor，保存 source、HTTPS provenance URL、scope、stable vector、expected output、tolerance 與 deterministic PASS/FAIL。

新增 power-firmware anchors 使用公開的 TI C2000 ePWM/ADC-SOC、CMPSS/trip API contract，以及 SI period/time dimensional contract。Runtime/CI 使用 repository 內 golden vectors，不在學習時依賴網路。

**External Anchor PASS 仍不等於 hardware certification。**

## Typed Observables

A-capable path 保留 typed：

```text
inputs
outputs
state
```

Tutor 只擁有 simulator interaction evidence；independent oracle evidence 由 oracle browser bridge 單一擁有，避免 duplicate PASS inflation。

## Mutation Fault Detection Rate

Current mutation campaign 對 **16** 條 A-capable path 注入代表性工程錯誤，包括 gain/scale corruption、dq swap、Hz conversion、timing-margin sign、stuck state、DAC off-by-one、PF sign/trig error、OP AMP missing `2π`，以及新加入的 sample deadline、protection filter latency、capstone margin faults。

CI 要求 independent verification layer 抓到所有 injected fault。這是 fault-detection metric，不是 code coverage theater。

## Coverage / Uncertainty / Adaptive Sequencing

Progress 明確區分 taught / practiced / measured / verified，並顯示 paired baseline/transfer、95% Wilson interval、paired N、confidence calibration 與 retention。

Local psychometric signal：

- `<4` first attempts：`insufficient`
- `4–7`：`provisional`
- `>=8`：`usable`

這是單一 learner 的 local measurement-quality signal，不是 population IRT 或標準化測驗效度證明。

Adaptive ranking 保持 deterministic / reviewable：retention due → unseen transfer → retention establishment → maintenance，再以 module importance、confidence uncertainty 與時間預算排序。

## Stable identity / state compatibility

Tutor 只使用 normalized canonical `item.id`。新內容使用 object + explicit immutable ID。V5 state 負責 canonical ↔ legacy aliases、semantic import merge 與 V2/V3/V4 migration。

Power Firmware Path 不改 storage key，因此既有 Prediction、attempt、report、retention 與 evidence history 可延續。

## 驗證

```text
node tools/validate-project.mjs
npm test
npm run test:e2e
```

CI 必須覆蓋：

- syntax / links / resources / public-content guard
- state migration / semantic merge
- Prediction preregistration / post-hoc
- wrong-variant cannot-wash transfer
- 16-module seeded transfer / retention
- 1d/7d/30d/90d spaced retrieval
- independent oracle disagreement / state invariants
- deterministic reasoning fail-closed
- Wilson uncertainty / paired denominator
- 21 seeded numeric task families
- 14 Bayesian diagnostic cases
- 16 external anchors / golden vectors
- typed observable provenance
- 16-path engineering mutation campaign / FDR
- PWM/ADC same-cycle timing and shadow-delay guards
- hardware/software protection latency boundary
- generic capstone critical-path / background separation
- prerequisite DAG / adaptive ranking / insufficient psychometric labeling
- Chromium desktop/mobile end-to-end flows

## 維護停止線

1. Production model 可以教學，但不可單獨自我證明 A。
2. Independent reference 不得呼叫 production calculation function。
3. Prediction、attempt、report 保留 immutable history。
4. Transfer 必須是 unseen first attempt，且工程條件真的改變。
5. `unmeasured` / `insufficient` 必須是合法狀態，不得被 UI 隱藏。
6. Diagnostic information gain 必須由 probability update 計算。
7. External anchor 必須保存 source、scope、golden vector 與 tolerance。
8. A / Anchor 都不得被描述成 hardware certification。
9. 新公式附 units、assumptions、invalid conditions、reference、version 與 tests。
10. **V8 之後停止為框架本身擴版。新 infrastructure 必須能回答：「它會改善哪一個未見情境下的工程判斷、診斷或 retention 指標？」答不出來就不做。**
