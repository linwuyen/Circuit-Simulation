# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「**預測 → 操作 → 獨立驗證 → 因果解釋 → 未見遷移 → 間隔取回 → 外部錨定**」為核心的電路、韌體與電力電子學習系統。

真正 KPI 不是完成頁數，而是：面對沒看過的工程條件時，**第一次判斷是否正確、證據是否可獨立驗證、信心是否校準、隔一段時間後是否仍能取回，以及教材模型是否有外部可追溯依據**。

## 公開內容界線

此 repository 只保存可公開的通用教材。公司專案、產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料不得進入公開 Git 歷史。

## Production truth

- **V3**：唯一 production renderer。
- **V5**：唯一 durable learning-state schema，key 為 `circuit-learning-state-v5`。
- **V6**：measurement-validity semantics；independent oracle、deterministic reasoning、true transfer、uncertainty、Bayesian diagnosis。
- **V7**：lab verification closure；當時 38/38 lab 有 contract，12/12 module 有 A-capable independent path。
- **V8**：external validity + real engineering transfer；當時 12/12 module 正式 transfer/retention、12 external anchors、12 numeric open-response、10 Bayesian diagnostic cases、typed observables、mutation FDR、cross-module competency graph 與 evidence-based adaptive sequencing。
- **OP AMP content extension**：不建立 V9 framework；沿用 V3/V5/V8，把 Slew Rate / Dynamic Response 加為第 13 模組。Current production 為 13 modules、41 labs、15 seeded numeric task families、11 Bayesian diagnostics、13 external anchors、13 A-capable paths 與 13-path mutation campaign。

V6/V7/V8 與後續內容擴充都**沒有**另造新的 persistence schema；避免為版本號本身製造遷移成本。

詳細文件：

- [`docs/runtime-architecture.md`](docs/runtime-architecture.md)
- [`docs/verification-v7.md`](docs/verification-v7.md)
- [`docs/measurement-v8.md`](docs/measurement-v8.md)
- [`docs/opamp-slew-rate.md`](docs/opamp-slew-rate.md)

## 核心架構

```text
curriculum.js + opamp-module.js
      ↓
curriculum-schema-v3.js
      ↓ normalized curriculum + canonical identity
quiz-bank.js + assessment-v8.js + opamp-assessment.js
      ↓ 13-module baseline / unseen transfer / retention
engineering-models.js
      ↓ production teaching/calculation model
model-registry.js
      ↓ executable model + semantic version + units
lab-oracles.js + opamp-verification.js
      ↓ independent reference / black-box comparison / state invariant
observables-v8.js + OP AMP typed oracle snapshot
      ↓ typed inputs / outputs / state contract
external-anchors-v8.js + opamp-external.js
      ↓ public source provenance + stable golden vectors
learning-evidence.js   ← circuit-learning-state-v5
      ↓ immutable Prediction / report / attempt evidence
learning-assessment.js
      ↓ first-attempt semantics + spaced retention + Wilson CI
engineering-challenges.js + engineering-challenges-v8.js + opamp-assessment.js
      ↓ 15 seeded numeric tasks + 11 Bayesian diagnostic cases
mutation-v8.js + OP AMP mutation extension
      ↓ injected engineering faults + Fault Detection Rate
learning-v3.js
      ↓ production renderer / progression policy
verification-v7.js + verification-v8.js + opamp-post.js
      ↓ verification / coverage / external-validity policy
Home / Beginner / Labs / Troubleshooting / Progress / Quiz / Search / Report

Lesson / simulator page
      ↓
tutor.js
      ↓ normalized canonical item ID
      ↓ typed observable snapshot
lab-oracles.js + learning-evidence.js
```

## Evidence semantics

強 evidence 的第一個要求是 Prediction **真的發生在看到結果之前**：

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

**A 不等於 hardware certification。** A 只代表「對公開教材/模型 contract 的獨立驗證」。實體硬體的 tolerance、parasitics、layout、thermal、timing、安全認證仍需真實量測與相應標準。

## Independent verification

目前 13 個模組各保留至少一條 A-capable path，使用三種可審查方法：

1. **Registry ↔ independent reference**：production model 與手推 reference 分離。
2. **Black-box page-output comparison**：獨立解析式直接驗頁面實際輸出。
3. **State invariant**：安全/狀態機問題不用硬造數值 oracle。

沒有單一可辯護 ground truth 的 waveform diagnosis、開放式 tuning、procedural checklist、experiment record 等任務明確 **ceiling B**，不以假 oracle 充數。

OP AMP 的 A-capable path 為 `opamp.lab.opamp-sine`：頁面顯示的 required SR、worst-direction FPBW、slew margin 與 limited state 必須與獨立 `SRrequired=2πfVpk` implementation 一致，且 worst(`SR+`,`SR−`) / required SR 必須落在 1.2–1.5。

## Deterministic engineering reasoning

工作單不因「文字夠長」就算工程推理。核心 rubric 為：

1. Claim
2. Evidence
3. Mechanism
4. Boundary
5. Transfer

總分至少 8/10，且 Claim / Evidence / Mechanism 為必要項。A-capable lab 再加 domain-specific fail-closed gate；流暢但無物理/時序因果的 filler text 不能取得 A。

OP AMP A-grade reasoning 必須能指出 `dV/dt` / Slew Rate 機制、`2πfVpk` 或 zero-crossing 最大斜率，以及至少一個 GBW / settling / output swing / load 模型邊界。

## 13-module True Transfer

每個正式 competency family 至少具有：

```text
Baseline A
   ↓
seeded unseen Transfer B/C
   ↓
1d R1 → 7d R2 → 30d R3 → 90d R4
```

Transfer 不只換 prompt：generator 保存 `seed`、`transferDepth`、`representation`、`parameters`，且 depth 必須真的改變工程條件和/或表示方式。

答錯的 first-attempt variant 永遠不能靠重試洗成 transfer pass；必須換下一個 unseen variant。

正式 family 已涵蓋全部 13 modules：Buck、ADC、SPI、Inverter、FOC、PI、10 µs loop、BMS、AD5543、AFE、ACMC Pro、C2000 DDS、OP AMP Dynamic Response。

OP AMP transfer 會在 direct `SRrequired` calculation、reverse FPBW、scope-waveform interpretation 與 amplitude-dependent model selection 之間切換，不以 prompt clone 充數。

## Open-response：從 recognition 走向 generation

Seeded numeric task 現為 15 類。V8 的 12 類之外，OP AMP 新增：

- `opamp-open-required-sr`：由 Vpp + frequency 求最低 ideal SR
- `opamp-open-fpbw`：由 worst-direction SR + Vpp 求 slew-only FPBW
- `opamp-open-step-time`：由 ΔV + SR 求 pure-slew ramp 下界

每次答案保存 seed、parameters、unit、expected value、relative error 與 attempt history。

## Bayesian diagnostic reasoning

Diagnostic case 現為 11 個，涵蓋：

- SPI FIFO/service deadline
- Buck DCM
- ADC saturation
- PI oscillation / loop margin
- FOC angle / phase order
- 10 µs worst-case jitter
- BMS contactor actuation
- DAC polarity / mapping
- AFE current polarity / phase
- ACMC transient OCP
- OP AMP Slew Rate vs small-signal bandwidth vs output rail

每個 measurement 都有 `P(result | cause)`；系統用 Bayes update 更新 posterior，再由 Shannon entropy reduction 計算 information gain：

```text
prior hypotheses
      ↓ measurement result
posterior hypotheses
      ↓
IG = H(before) - H(after)
```

目標不是猜 root cause，而是訓練「下一個量什麼最能縮小假設空間」。

## External Reality Anchors

系統使用第三條 truth source：

```text
Teaching model
      ↓
Independent oracle
      ↓
External source + golden vector
```

13/13 modules 都有一個明確 scope 的 external anchor，保存：

- source description
- HTTPS provenance URL
- model/safety scope
- stable input vector
- expected output
- tolerance
- deterministic PASS/FAIL

OP AMP anchor 使用 TI Precision Labs Slew Rate primary source，並在專用文件中以 ADI high-speed driver資料交叉核對；golden vector 為 10 Vpp / 100 kHz → required SR 約 3.14159 V/µs。

Anchor 使用公開 manufacturer/standards equation、datasheet transfer definition、SI dimensional law 或 safety contract。Runtime/CI 使用 repository 內的 golden vector，不在學習時依賴網路。

**External Anchor PASS 仍不等於 hardware certification。** 它只表示教材 contract 有一個額外、可追溯的外部錨點。

## Typed Observables

13 個 A-capable lab 都有 typed verification path：

```text
inputs
outputs
state
```

V8 的既有 labs 使用 `observables-v8.js`；OP AMP sine lab 由 `opamp-verification.js` 直接產生 typed oracle snapshot。Tutor 繼續只擁有 simulator interaction evidence，independent oracle evidence 由 oracle browser bridge 單一擁有，避免 duplicate PASS inflation。

## Mutation Fault Detection Rate

Mutation campaign 現對 13 條 A-capable path 注入代表性工程錯誤，例如：

- gain/scale corruption
- dq swap
- Hz conversion error
- timing-margin sign error
- stuck contactor
- DAC off-by-one
- `sin` / `cos` PF error
- wrong protection state
- wrong real-power sign
- OP AMP missing `2π` / wrong full-power slope

CI 要求 independent verification layer 抓到所有注入 fault。這個 FDR 比單純 code coverage 更接近「測試能不能抓工程錯誤」。

## OP AMP Dynamic Response model boundary

OP AMP waveform simulator 刻意保持可審查：

1. closed-loop bandwidth 以 `GBW / gain` 建立一階 teaching pole；
2. 正、負方向分別套 `SR+ / SR−` slope clamp；
3. step 將 pure-slew lower bound 與後段 settling estimate 分開顯示；
4. sine 以 `2πfVpk` 判斷 required large-signal slope。

它不是 SPICE，也不是實體器件認證。真實 OP AMP 還可能受 output current、capacitive load stability、common-mode range、output swing、higher-order poles/zeros、overdrive recovery、temperature 與實際 PCB 寄生影響。

## Coverage、Uncertainty 與 Psychometric Boundary

Progress 明確區分 taught / practiced / measured / verified，並顯示 paired baseline/transfer、95% Wilson interval、paired N、confidence calibration 與 retention。

V8 的 local psychometric signal 只在有資料時才顯示：

- `<4` first attempts：`insufficient`
- `4–7`：`provisional`
- `>=8`：`usable`

這只是單一 learner 的 local measurement-quality signal，**不是 population IRT，也不是標準化測驗效度證明**。

## Evidence-based Adaptive Sequencing

Next-task ranking 是 deterministic、可審查的 scheduling，不是 ML recommender：

1. retention due
2. unseen transfer 尚未通過
3. transfer 已過但 retention 尚未建立
4. maintenance

再以 module importance、confidence uncertainty 與可用時間做次級排序。資料不足就顯示不足，不製造假精準。

## Stable identity / state compatibility

Tutor 只使用 normalized canonical `item.id`。Legacy positional curriculum arrays 仍可讀；OP AMP 新內容直接使用 object + explicit immutable ID。V5 state 負責 canonical ↔ legacy aliases、semantic import merge 與 V2/V3/V4 migration。

OP AMP extension 不改 storage key，因此既有 Prediction、attempt、report、retention 與 evidence history 可延續。

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
- 13-module seeded transfer / retention
- 1d/7d/30d/90d spaced retrieval
- independent oracle disagreement / state invariants
- deterministic reasoning fail-closed
- Wilson uncertainty / paired denominator
- 15 seeded numeric task families
- 11 Bayesian diagnostic cases
- 13 external anchors / golden vectors
- typed observable provenance
- 13-path engineering mutation campaign / FDR
- OP AMP missing-`2π`, Vpp/Vpk, unit-scale and worst-direction Slew Rate guards
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
8. A / Anchor 都不得被描述成硬體認證。
9. 新公式附 units、assumptions、invalid conditions、reference、version 與 tests。
10. **V8 之後停止為框架本身擴版。新 infrastructure 必須能回答：「它會改善哪一個未見情境下的工程判斷、診斷或 retention 指標？」答不出來就不做。**