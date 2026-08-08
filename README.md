# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「預測 → 操作 → 獨立驗證 → 因果解釋 → 真遷移 → 間隔取回」為核心的電路、韌體與電力電子學習系統。真正 KPI 不是完成頁數，而是面對未見過的工程條件時，**第一次判斷是否正確、證據是否可獨立驗證、信心是否校準、隔一段時間後是否仍能取回**。

## 公開內容界線

此 repository 只保存可公開的通用教材。公司專案、產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料不得進入公開 Git 歷史。

## Production 架構

V3 仍是唯一 production renderer；V5 仍是 durable learning-state schema。**V6 是 measurement-validity semantics**，刻意不再增加一個不相容的 localStorage schema。

```text
curriculum.js
      ↓
curriculum-schema-v3.js
      ↓ normalized curriculum + canonical identity
quiz-bank.js
      ↓
engineering-models.js
      ↓ production teaching/calculation model
model-registry.js
      ↓ executable model + semantic version + IO units
lab-oracles.js
      ↓ independent hand-derived reference + production/reference agreement
learning-evidence.js   ← circuit-learning-state-v5
      ↓ immutable Prediction / report / attempt evidence
learning-assessment.js
      ↓ seeded true-transfer + reasoning rubric + Wilson CI + coverage
engineering-challenges.js
      ↓ seeded numeric generation + Bayesian diagnostic inference
learning-v3.js
      ↓ V6 renderer / progression policy
Home / Beginner / Labs / Troubleshooting / Progress / Quiz / Search / Report

Lesson / simulator pages
      ↓
tutor.js
      ↓ normalized curriculum + canonical item ID
      ↓
lab-oracles.js + learning-evidence.js
```

詳細 ownership 見 [`docs/runtime-architecture.md`](docs/runtime-architecture.md)。

## V6 的核心：不要讓模型自我證明

V5 的 structured oracle 已能保存 model provenance，但 simulator 與 oracle 仍可能共用同一個 production implementation。V6 把「教學計算」與「驗證真相」拆成兩條實作路徑：

```text
same normalized inputs
      ├─ production Model Registry
      └─ independent reference implementation
                    ↓
               agreement check
                    ↓
             acceptance rule
```

目前 independent reference-backed oracle 覆蓋：

- Buck 20% current-ripple lab；
- ADC divider lab。

A 級 evidence 必須同時滿足 production/reference agreement 與 acceptance rule。故意把 production model 算錯時，oracle regression test 必須失敗；沒有 independent reference 的 simulator 最多只能拿 B，不會假裝成 A。

## Prediction integrity

強 evidence 的第一個要求不是「有填 Prediction」，而是 Prediction **真的發生在看到結果之前**。

```text
Prediction Commit
      ↓
first simulator event
      ↓
Observation
```

- 第一版 Prediction 以 revision 保存，不可被事後文字覆蓋。
- 若先操作 simulator 再補 Prediction，明確標為 **post-hoc**。
- 後續仍可修訂，但 revision history 保留。

## Stage 與 Evidence Strength 分離

| Strength | 意義 |
|---|---|
| C | human-only 或 post-hoc evidence |
| B | preregistered Prediction + machine interaction + reasoning rubric pass |
| A | preregistered Prediction + **independent oracle PASS** + reasoning rubric pass |

Stage 仍是 Viewed → Practiced → Verified → Retained；stage 與 evidence strength 是不同維度。

## Deterministic Engineering Reasoning Rubric

工作單不再因為「文字夠長」就視為工程推理。完成時對五個 proposition 各評 0–2 分：

1. **Claim**：預測是否有可檢驗方向；
2. **Evidence**：觀察是否有數值/狀態且與 machine evidence 一致；
3. **Mechanism**：是否指出公式、物理機制或時序因果；
4. **Boundary**：是否知道模型在何處失效；
5. **Transfer**：是否能對新條件提出可檢驗推論。

總分至少 8/10，且 Claim / Evidence / Mechanism 都必須存在。Buck ripple 與 ADC divider 有 domain-specific deterministic checks；流暢但無因果的 filler text 會被拒絕。

## True Transfer：不是改題目前綴

每個 assessment family 都保留 baseline A，但 B/C/Retention 由 deterministic seed 產生，並保存：

- `seed`；
- `transferDepth`；
- `representation`；
- immutable first-attempt history。

高品質 family 會改變參數、表示方式或情境，例如：

- Buck ripple：L 參數題 → waveform inference → switched-inductor context；
- Buck validity：model-selection transfer；
- ADC：不同 bits / divider 數值 / Vref；
- SPI：不同 frame timing、FIFO deadline、mode mismatch。

答錯的 seed/variant 永遠不能靠重試洗成 transfer pass；生成不了高品質 variant 時，系統直接顯示 coverage gap，不用低品質 prompt clone 補洞。

## Spaced Retention

Retention 從 `transferPassedAt` 開始：

```text
Transfer PASS → 1d R1 → 7d R2 → 30d R3 → 90d R4
```

到期 review 答錯會降低 retention stage；主線只要求 transfer，不會被 90 天等待阻塞。

## Benchmark：顯示不確定度，不製造假精準

首頁與 Progress 只比較同時具有 baseline 與 transfer first-attempt 的同一批 competency，並顯示：

- paired baseline / transfer accuracy；
- 95% Wilson confidence interval；
- delta percentage points 與保守區間；
- paired sample size `N`；
- evidence grade：VERY LOW / LOW / MODERATE / HIGH；
- confidence calibration；
- retention stage。

小樣本不再只顯示一個看似精準的百分比。

## Measurement Coverage Matrix

`progress.html` 明確區分：

- taught；
- practiced；
- measured（有 seeded transfer + retention）；
- verified（另有 independent oracle）。

因此 **absence of failure 不等於 evidence of competence**。目前沒有 assessment coverage 的主題會明確顯示，而不是因為沒有紅燈就被當成 mastered。

## Parameterized Numeric Open-response

Buck / ADC / SPI 的 numeric task 由 seed 產生新參數，答案保存 seed、parameters、unit、relative error 與 attempt history。seed 0 保留固定 regression vector；後續 attempt 會換條件，避免背固定答案。

## Bayesian Diagnostic Games

Diagnostic game 不再人工填 `informationGain: 5`。每個 hypothesis 有 prior，每個 measurement 有 likelihood `P(result | cause)`：

```text
prior hypotheses
      ↓ measurement result
Bayes update
      ↓
posterior hypotheses
      ↓
IG = H(before) - H(after)
```

UI 顯示 entropy、實際 information gain（bits）與 posterior；效率分數同時考慮 root-cause correctness、posterior concentration、資訊增益與 test cost。

目前案例：

- SPI FIFO/service-deadline；
- Buck DCM。

## Stable Identity / State Compatibility

Tutor 只使用 normalized canonical `item.id`；新建或大幅修改 curriculum item 使用 object form + explicit immutable ID。Legacy positional arrays 仍可讀，V5 state 仍負責 canonical ↔ legacy aliases、semantic import merge 與 V2/V3/V4 migration。

V6 沒有改 state schema key，因為 seed、rubric、oracle provenance 都能加入既有 V5 event/history 結構；避免為版本號本身製造遷移成本。

## Engineering Model Registry

正式模型仍由 `engineering-models.js` + `model-registry.js` 擁有。Executable registry 包含 Buck、ADC、SPI timing、PWM average、discrete PI、DAC mapping、DDS phase increment；FOC/BMS/AFE/ACMC 在沒有足夠假設與測試時只保留 heuristic card，不冒充精確模型。

## 驗證

```text
node tools/validate-project.mjs
npm test
npm run test:e2e
```

CI 必須覆蓋：

- syntax / links / resources / public-content guard；
- V2/V3/V4 → V5 state migration 與 semantic merge；
- Prediction preregistration / post-hoc；
- wrong-variant cannot-wash transfer；
- seeded parameter / representation transfer；
- 1d/7d/30d/90d retention；
- Wilson interval / paired denominator；
- independent oracle disagreement detection；
- oracle metamorphic invariants；
- deterministic reasoning rejection/acceptance；
- measurement coverage states；
- parameterized numeric generation；
- Bayesian entropy / posterior / information gain；
- Chromium desktop/mobile end-to-end flows。

## 維護原則

1. Production model 可以教學，但不可單獨自我證明 A 級 evidence。
2. Independent reference 不得呼叫 production calculation function。
3. Prediction、attempt、report 保留 immutable history。
4. Transfer 必須是 seeded unseen first attempt；無高品質 generator 就留下 coverage gap。
5. A 級工作單必須通過 deterministic reasoning rubric。
6. Benchmark 必須顯示 paired N 與 uncertainty。
7. `unmeasured` 必須是合法狀態，不得被 UI 隱藏。
8. Diagnostic information gain 必須由 probability update 計算。
9. 新公式附 units、assumptions、invalid conditions、reference、version 與 tests。
10. 不以完成頁數當能力；優先看 independently verified transfer、calibration 與 retained performance。