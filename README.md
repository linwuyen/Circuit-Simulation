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
- **V7**：lab verification closure；38/38 lab 有 contract，12/12 module 有 A-capable independent path。
- **V8**：external validity + real engineering transfer；12/12 module 正式 transfer/retention、12 external anchors、12 numeric open-response、10 Bayesian diagnostic cases、typed observables、mutation FDR、cross-module competency graph 與 evidence-based adaptive sequencing。

V6/V7/V8 都**沒有**另造新的 persistence schema；避免為版本號本身製造遷移成本。

詳細文件：

- [`docs/runtime-architecture.md`](docs/runtime-architecture.md)
- [`docs/verification-v7.md`](docs/verification-v7.md)
- [`docs/measurement-v8.md`](docs/measurement-v8.md)

## 核心架構

```text
curriculum.js
      ↓
curriculum-schema-v3.js
      ↓ normalized curriculum + canonical identity
quiz-bank.js + assessment-v8.js
      ↓ 12-module baseline / unseen transfer / retention
engineering-models.js
      ↓ production teaching/calculation model
model-registry.js
      ↓ executable model + semantic version + units
lab-oracles.js
      ↓ independent reference / black-box comparison / state invariant
observables-v8.js
      ↓ typed inputs / outputs / state contract
external-anchors-v8.js
      ↓ public source provenance + stable golden vectors
learning-evidence.js   ← circuit-learning-state-v5
      ↓ immutable Prediction / report / attempt evidence
learning-assessment.js
      ↓ first-attempt semantics + spaced retention + Wilson CI
engineering-challenges.js + engineering-challenges-v8.js
      ↓ 12 seeded numeric tasks + 10 Bayesian diagnostic cases
mutation-v8.js
      ↓ injected engineering faults + Fault Detection Rate
learning-v3.js
      ↓ production renderer / progression policy
verification-v7.js + verification-v8.js
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

V7/V8 對 12 個模組各保留至少一條 A-capable path，使用三種可審查方法：

1. **Registry ↔ independent reference**：production model 與手推 reference 分離。
2. **Black-box page-output comparison**：獨立解析式直接驗頁面實際輸出。
3. **State invariant**：安全/狀態機問題不用硬造數值 oracle。

沒有單一可辯護 ground truth 的 waveform diagnosis、開放式 tuning、procedural checklist、experiment record 等任務明確 **ceiling B**，不以假 oracle 充數。

## Deterministic engineering reasoning

工作單不因「文字夠長」就算工程推理。核心 rubric 為：

1. Claim
2. Evidence
3. Mechanism
4. Boundary
5. Transfer

總分至少 8/10，且 Claim / Evidence / Mechanism 為必要項。A-capable lab 再加 domain-specific fail-closed gate；流暢但無物理/時序因果的 filler text 不能取得 A。

## 12-module True Transfer

每個正式 competency family 至少具有：

```text
Baseline A
   ↓
seeded unseen Transfer B/C
   ↓
1d R1 → 7d R2 → 30d R3 → 90d R4
```

Transfer 不只換 prompt：V8 generator 同時保存 `seed`、`transferDepth`、`representation`、`parameters`，且 depth 必須真的改變工程條件和/或表示方式。

答錯的 first-attempt variant 永遠不能靠重試洗成 transfer pass；必須換下一個 unseen variant。

正式 family 已涵蓋全部 12 modules：Buck、ADC、SPI、Inverter、FOC、PI、10 µs loop、BMS、AD5543、AFE、ACMC Pro、C2000 DDS。

## Open-response：從 recognition 走向 generation

Seeded numeric task 從原本 Buck / ADC / SPI 擴到 12 類，新增：

- FOC Park projection
- PI integrator crossover
- 10 µs timing margin
- AD5543 code mapping
- AFE displacement PF
- DDS real power
- Inverter dead-time lower bound
- BMS/AFE divider voltage
- ACMC sinusoidal peak-current teaching estimate

每次答案保存 seed、parameters、unit、expected value、relative error 與 attempt history。

## Bayesian diagnostic reasoning

Diagnostic case 共 10 個，涵蓋：

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

V8 加入第三條 truth source：

```text
Teaching model
      ↓
Independent oracle
      ↓
External source + golden vector
```

12/12 modules 都有一個明確 scope 的 external anchor，保存：

- source description
- HTTPS provenance URL
- model/safety scope
- stable input vector
- expected output
- tolerance
- deterministic PASS/FAIL

Anchor 使用公開 manufacturer/standards equation、datasheet transfer definition、SI dimensional law 或 safety contract。Runtime/CI 使用 repository 內的 golden vector，不在學習時依賴網路。

**External Anchor PASS 仍不等於 hardware certification。** 它只表示教材 contract 有一個額外、可追溯的外部錨點。

## Typed Observables

`observables-v8.js` 為 12 個 A-capable lab 定義 typed：

```text
inputs
outputs
state
```

Tutor 在 lesson page 載入 typed observable contract，再交給 V7 independent oracle。這降低 oracle 對散落 DOM 文案/regex 的依賴，同時保留 V7 acceptance semantics 與舊 snapshot 相容性。

## Mutation Fault Detection Rate

`mutation-v8.js` 對 12 條 A-capable path 注入代表性工程錯誤，例如：

- gain/scale corruption
- dq swap
- Hz conversion error
- timing-margin sign error
- stuck contactor
- DAC off-by-one
- `sin` / `cos` PF error
- wrong protection state
- wrong real-power sign

CI 要求 independent verification layer 抓到所有注入 fault。這個 FDR 比單純 code coverage 更接近「測試能不能抓工程錯誤」。

## Coverage、Uncertainty 與 Psychometric Boundary

Progress 明確區分 taught / practiced / measured / verified，並顯示 paired baseline/transfer、95% Wilson interval、paired N、confidence calibration 與 retention。

V8 的 local psychometric signal 只在有資料時才顯示：

- `<4` first attempts：`insufficient`
- `4–7`：`provisional`
- `>=8`：`usable`

這只是單一 learner 的 local measurement-quality signal，**不是 population IRT，也不是標準化測驗效度證明**。

## Evidence-based Adaptive Sequencing

V8 的 next-task ranking 是 deterministic、可審查的 scheduling，不是 ML recommender：

1. retention due
2. unseen transfer 尚未通過
3. transfer 已過但 retention 尚未建立
4. maintenance

再以 module importance、confidence uncertainty 與可用時間做次級排序。資料不足就顯示不足，不製造假精準。

## Stable identity / state compatibility

Tutor 只使用 normalized canonical `item.id`。Legacy positional curriculum arrays 仍可讀；V5 state 負責 canonical ↔ legacy aliases、semantic import merge 與 V2/V3/V4 migration。

V8 不改 storage key，因此既有 Prediction、attempt、report、retention 與 evidence history 可延續。

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
- 12-module seeded transfer / retention
- 1d/7d/30d/90d spaced retrieval
- independent oracle disagreement / state invariants
- deterministic reasoning fail-closed
- Wilson uncertainty / paired denominator
- 12 seeded numeric task families
- 10 Bayesian diagnostic cases
- 12 external anchors / golden vectors
- typed observable provenance
- 12-path engineering mutation campaign / FDR
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
