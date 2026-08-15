# Power Electronics Firmware Engineer Path

這個版本不建立 V9 framework。Production renderer 仍是 V3，durable state 仍是 V5，measurement / transfer / external-validity semantics 延續 V6–V8。

## Product definition

系統的目標不是累積更多獨立 module，而是訓練一條可遷移的工程因果鏈：

```text
Requirement
  ↓
Power physics
  ↓
Sensing / scaling
  ↓
PWM-triggered sampling
  ↓
Real-time control
  ↓
PWM actuation
  ↓
Protection / state
  ↓
Communication / data ownership
  ↓
Observation / diagnosis
```

首頁以六層 skill path 呈現：

1. Power Physics
2. Sensing
3. Timing & Control
4. Protection & State
5. Communication & Actuation
6. System Integration

## New modules

### PWM → ADC → ISR Synchronization

核心 competency：`power-sync.sample-update.deadline`

- PWM event → ADC SOC
- acquisition + conversion latency
- ISR / control execution deadline
- switching-edge sample placement
- PWM shadow load / one-cycle delay

A-capable lab：`power-sync.lab.timing`

Independent oracle 重新計算 period、sample instant、data-ready、control-done 與 same-cycle margin；A acceptance 要求 margin ≥ 1 µs。

### Power Protection Architecture

核心 competency：`protection.trip.latency`

- hardware comparator/filter/trip path
- software ADC/ISR decision path
- filtering / blanking latency tradeoff
- fault latch / re-arm
- fail-closed startup sequencing

A-capable lab：`protection.lab.trip-latency`

Independent oracle 分別累加 hardware 與 software serial path；A acceptance 要求 hardware path ≤ 1 µs 且快於 software path。

### Programmable Power Converter Capstone

核心 competency：`capstone.signal-chain.integration`

- generic signal chain / unit ownership
- serial critical-path budget
- background communication isolation
- sensing/control/stale-data fault isolation
- Power → Clock → Reset → Signal → Timing → Data → State → Control → Plant debug ladder

A-capable lab：`power-capstone.lab.integration-budget`

Independent oracle 只計算 serial sensing → control → PWM-commit critical path；A acceptance 要求 deterministic margin ≥ 2 µs。

## Engineering capability ladder

Progress page另外顯示 L0–L7：

- L0 Recognize
- L1 Calculate
- L2 Predict
- L3 Measure
- L4 Diagnose
- L5 Design
- L6 Integrate
- L7 Debug unknown system

最高目標不是記憶 module，而是面對 unseen system 時仍能選對 measurement、建立 causal chain、指出 model boundary 並收斂 root cause。

## Measurement expansion

Current production after this extension：

- 16 modules
- 50 classified labs
- 16 modules with an A-capable independent path
- 21 seeded numeric open-response task families
- 14 Bayesian diagnostic cases
- 16 external reality anchors
- 16 representative mutation paths

三個新 formal family 各包含 baseline → 3 unseen transfer variants → R1/R2/R3/R4 retention。

## External validity

新增三個 public anchors：

- TI C2000 ePWM event-trigger / ADC SOC API contract
- TI C2000 CMPSS comparator/filter/trip routing contract
- BIPM SI period/time dimensional contract for the generic integration budget

External anchor 只證明教材 contract 有公開可追溯基礎，不是 hardware certification。

## Public-content boundary

這個 Capstone **不是任何公司產品的 clone**。

禁止進入 public Git history：

- 公司產品名稱 / internal model number
- schematic / PCB net name / pin map
- proprietary command / protocol payload
- firmware snapshot
- internal threshold / calibration constant / control coefficient
- company measurement log / customer specification

允許公開的是抽象後的 engineering pattern：

- producer / consumer ownership
- sample / compute / actuation timing
- scale / offset / unit chain
- protection latency / state invariant
- generic control / communication / diagnosis structure

## Maintenance stop rule

後續新增 infrastructure 前必須回答：

> 哪一種 unseen engineering judgment 因此變得更有效、更可診斷或更耐久？

若無法回答，就不要再為版本號建立 framework。優先新增 real engineering scenario、fault injection、waveform/timing reasoning 與 system-level transfer。
