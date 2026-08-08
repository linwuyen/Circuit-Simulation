# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「預測 → 操作 → 觀察 → 解釋 → 未見情境遷移 → 間隔取回」為核心的電路、韌體與電力電子學習系統。真正 KPI 不是完成頁數，而是面對未見過的工程條件時，**第一次判斷是否正確、信心是否校準、隔一段時間後是否仍能取回**。

## 公開內容界線

此 repository 只保存可公開的通用教材。公司專案、產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料不得進入公開 Git 歷史。

## Production 架構

V3 是唯一 production renderer；V5 是唯一 production learning-state schema。

```text
curriculum.js
      ↓
curriculum-schema-v3.js
      ↓ normalized curriculum + canonical identity
quiz-bank.js
      ↓
engineering-models.js
      ↓
model-registry.js
      ↓ executable model + semantic version + IO units
lab-oracles.js
      ↓ structured model-backed acceptance
learning-evidence.js   ← circuit-learning-state-v5
      ↓ Prediction / report revisions / evidence / semantic merge
learning-assessment.js
      ↓ unseen first-attempt transfer / calibration / spaced retention
engineering-challenges.js
      ↓ numeric open-response / diagnostic games
learning-v3.js
      ↓
Home / Beginner / Labs / Troubleshooting / Progress / Quiz / Search / Report

Lesson / simulator pages
      ↓
tutor.js
      ↓ normalized curriculum + canonical item ID
      ↓
同一個 learning-evidence.js
```

詳細 ownership 見 [`docs/runtime-architecture.md`](docs/runtime-architecture.md)。

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
- 若先操作 simulator 再補 Prediction，會明確標為 **post-hoc**。
- 後續仍可修訂 Prediction，但 revision history 保留。

## Stage 與 Evidence Strength 分離

「做到哪一步」與「這份證據有多可信」不是同一件事。

### Stage

| Stage | 意義 |
|---|---|
| Viewed | 看過教材/實驗 |
| Practiced | 實際操作或 simulator interaction |
| Verified | 工作單與驗證條件完成 |
| Retained | 通過間隔取回 |

### Evidence Strength

| Strength | 意義 |
|---|---|
| C | human-only 或 post-hoc evidence |
| B | preregistered Prediction + machine interaction + human reasoning |
| A | preregistered Prediction + structured machine oracle PASS + human reasoning |

**Machine interaction 不等於 machine verification。**

## Structured Machine Evidence

正式 machine verification 會保存：

- model ID；
- model semantic version；
- normalized inputs；
- model outputs；
- acceptance target；
- measured value；
- pass/fail。

目前 structured oracle 優先覆蓋：

- Buck 20% current-ripple lab；
- ADC divider lab。

其他 simulator 頁面仍可留下 interaction evidence，但在建立 canonical model + acceptance rule 前，不會被標成 structured machine-verified。

## Assessment：不能靠重試洗成會

每個高品質 diagnostic competency 使用 question family。

```text
Variant A first attempt → Baseline
            ↓
Recovery / feedback
            ↓
Unseen transfer variant first attempt
            ├─ correct → Transfer PASS
            └─ wrong   → 該 variant 永久失去 transfer 資格
                         必須換下一個 unseen variant
```

因此「同一題點到答對」只代表 recovery，不代表 transfer。

每次作答會保存：

- correct / incorrect；
- first-attempt eligibility；
- response duration；
- confidence；
- assessment role；
- immutable attempt history。

## Spaced Retention

Retention 時鐘從 **`transferPassedAt`** 開始，不從第一次答對開始。

```text
Transfer PASS
    ↓ 1 day
R1
    ↓ 7 days
R2
    ↓ 30 days
R3
    ↓ 90 days
R4
```

到期 review 答錯會降低 retention stage。主線學習只要求 transfer，不要求先等 90 天，因此 spaced review 不阻塞新主題。

## Benchmark

首頁與 Progress 使用 paired benchmark：只比較同時有 baseline 與 transfer first-attempt 的同一批 competency。

顯示：

- paired baseline accuracy；
- paired transfer accuracy；
- delta percentage points；
- paired sample size `N`；
- confidence calibration gap；
- R1+ retained；
- R4 retained；
- review due。

因此不會再用不同 denominator 製造假的提升幅度。

## Numeric Open-response

選擇題主要測 recognition；工程能力還需要 generation。

目前 open-response 包含：

- Buck：由 Vin / Vout / fsw / Iout / ripple target 反解 L；
- ADC：由高壓輸入 / Vref / Rbot 反解 Rtop；
- SPI：由 SCLK / bits 求 frame time。

答案以數值、單位與 tolerance 驗證，不提供選項讓使用者猜。

## Diagnostic Games

Troubleshooting 不只顯示答案，也提供逐步 diagnostic game：

```text
只給症狀
  ↓
選 measurement / test
  ↓
取得新 evidence
  ↓
更新 hypotheses
  ↓
判斷 root cause
```

評分同時考慮：

- 是否找到正確 root cause；
- test cost；
- information gain；
- diagnostic efficiency。

目前包含 SPI FIFO/服務期限與 Buck DCM 診斷案例。

## Stable Identity

Tutor 不再解析 positional array 或用 title 自己產生 ID；所有教材內頁都先經 `CircuitSchema.normalizeCurriculum()`，再直接使用 canonical `item.id`。

維護政策：

- **新建或大幅修改** lesson/lab/fault 使用 object form + explicit immutable `id`；
- legacy positional arrays 仍保留相容性，不要求一次性破壞性重寫；
- V5 會鏡射 canonical ID 與 legacy aliases 的 evidence / prediction / report；
- 若 title 與 path 同時重定義，必須提供 explicit migration alias；
- ID 表示 identity，不表示顯示文字。

## Engineering Model Registry

正式可精算模型由 `engineering-models.js` 實作，再由 `model-registry.js` 暴露。

Executable registry 目前包括：

- Buck CCM ripple / boundary；
- ADC quantization；
- ADC divider；
- SPI frame/FIFO timing；
- PWM averaged voltage；
- discrete PI step；
- DAC code mapping；
- DDS phase increment。

每個正式模型包含：

- semantic version；
- executable pure function；
- input/output units；
- assumptions；
- invalid conditions；
- references；
- test IDs。

FOC、BMS、AFE、ACMC 尚未建立足夠假設與驗證時，只以 heuristic architecture card 呈現，不冒充精確模型。

## Safe State Import

V5 import 不使用 shallow `Object.assign` 覆蓋本機狀態，而是 semantic merge：

- evidence 保留較強/較新的 claim；
- machine snapshots 依 digest 去重 union；
- question attempts 依 event ID union；
- Prediction / Report revisions 保留歷史；
- numeric response / diagnostic-game histories union。

因此舊備份不能靜默把較強的新 evidence 降級。

## 本機執行

```text
python -m http.server 8080
```

開啟 `http://localhost:8080/`。

## 驗證

需要 Node.js 18 以上：

```text
node tools/validate-project.mjs
npm test
npm run test:e2e
```

GitHub Actions 驗證包括：

- link / script / stylesheet / resource；
- curriculum 路徑與 JavaScript syntax；
- V2/V3/V4 → V5 migration；
- canonical identity / legacy alias reconciliation；
- Prediction preregistration 與 simulator-first post-hoc 判定；
- unseen first-attempt transfer；
- transfer-based 1d/7d/30d/90d retention；
- paired benchmark；
- model-backed lab oracle 與 provenance；
- semantic import merge；
- executable model invariants；
- numeric open-response；
- diagnostic-game scoring；
- Chromium desktop/mobile flows；
- public-content 防呆。

## 維護原則

1. 一個正式工程量只有一個 canonical implementation。
2. Prediction、attempt、report 都保留 immutable history。
3. Transfer 只能來自 unseen first attempt。
4. Simulator interaction 與 structured verification 永遠分開。
5. 新 curriculum item 使用 explicit stable ID + competency。
6. 錯誤選項必須對應具體 misconception。
7. 新公式附 IO 單位、假設、失效條件、reference、version 與 test。
8. Heuristic 必須明確標示，不可冒充設計模型。
9. Import 不得降低較強的新 evidence。
10. 不以完成頁數當能力；優先看 first-attempt transfer、calibration 與 retained performance。