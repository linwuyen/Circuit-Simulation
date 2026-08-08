# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「預測 → 操作 → 觀察 → 解釋 → 遷移 → 延遲取回」為核心的互動式電路、韌體與電力電子學習系統。真正 KPI 不是看過多少頁，而是面對未見過的工程條件時，首次判斷是否變得更準確。

## 公開內容界線

此 repository 只保存可公開的通用教材。公司專案、產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料不得進入公開 Git 歷史。

## Production 架構

V3 仍是唯一 production renderer；學習資料已收斂到 V4 evidence state。

```text
curriculum.js
      ↓
curriculum-schema-v3.js
      ↓
quiz-bank.js
      ↓
engineering-models.js
      ↓
model-registry.js
      ↓
learning-evidence.js   ← circuit-learning-state-v4
      ↓
learning-assessment.js ← baseline / transfer / retention
      ↓
learning-v3.js + learning-v3.css
      ↓
Home / Beginner / Labs / Troubleshooting / Progress / Quiz / Search / Report

Lesson / simulator pages
      ↓
tutor.js
      ↓
同一個 learning-evidence.js
```

- `curriculum-schema-v3.js`：課程正規化、stable identity 與 legacy alias。
- `engineering-models.js`：正式 pure calculation functions。
- `model-registry.js`：可執行 model registry，包含版本、IO 單位、假設、失效條件、references 與 tests。
- `learning-evidence.js`：唯一正式 evidence store；自動遷移 V3/V2 狀態。
- `learning-assessment.js`：baseline、variant transfer、24 小時 delayed retrieval、competency prerequisite DAG 與 benchmark。
- `learning-v3.js`：正式 renderer/state-machine consumer，不再自行擁有另一套 persistence。
- `tutor.js`：教材內頁與 simulator bridge；操作會寫回同一份 evidence。

架構 ownership 詳見 [`docs/runtime-architecture.md`](docs/runtime-architecture.md)。

## Evidence ladder

| Level | 意義 | 典型證據 |
|---|---|---|
| 1 | Viewed | 開啟教材或實驗 |
| 2 | Practiced | 實際操作、Tutor step、simulator snapshot |
| 3 | Verified | 工作單通過預測、參數、觀察、解釋、限制、遷移規則 |
| 4 | Retained | 通過 transfer，且至少 24 小時後再次正確取回 |

工作單可接受 human-only evidence，但會明確標示較弱；若 simulator 可提供客觀 snapshot，則合併成 machine + human evidence。

## Assessment：不是「點到答對」

每個診斷 competency 以 question family 管理：

1. **Baseline**：第一個 variant 的首次作答。
2. **Recovery**：答錯後能否修正心智模型。
3. **Transfer**：不同參數／敘述 variant 是否能解出。
4. **Retention**：通過 transfer 後，至少 24 小時再做延遲取回。

第一次答錯不會造成永久鎖死；主線在 transfer 通過後即可繼續，delayed retention 屬後續複習，不阻塞新主題。

`progress.html` 與首頁會顯示：

- baseline first-attempt accuracy；
- transfer first-attempt accuracy；
- transfer delta（percentage points）；
- transfer passed；
- delayed reviews due；
- retained competencies。

## Stable identity

新課程資料應使用 object + explicit `id`。Legacy positional arrays 仍相容，但 V4 evidence 會把 canonical ID 與目前的 legacy aliases 鏡射保存，因此單獨改標題或單獨改路徑不會讓既有 evidence 消失。

維護規則：

- 新增或大幅修改 lesson/lab/fault 時，使用 explicit ID。
- ID 一旦公開就不得重新定義語意。
- 改路徑或標題時保留 legacy alias。
- CI 必須覆蓋 identity migration/reconciliation。

## Engineering Model Registry

正式可精算模型由 `engineering-models.js` 實作，再由 `model-registry.js` 暴露；UI 不應複製正式公式。

目前 executable registry 包含：

- Buck CCM ripple / boundary；
- ADC quantization；
- ADC divider；
- SPI frame/FIFO timing；
- PWM averaged voltage；
- discrete PI step；
- DAC code mapping；
- DDS phase increment。

FOC、BMS、AFE、ACMC 目前先以 heuristic architecture card 呈現，避免把尚未建立足夠假設與測試的簡化模型偽裝成精確模型。

任何元件選型、保護門檻、安全驗證或量產設計，仍必須回到 datasheet、控制器文件、實際電路與量測。

## 標竿診斷模組

目前高品質 misconception/transfer 題庫優先覆蓋：

- **Buck**：漣波關係、CCM/DCM 邊界、模型適用性。
- **ADC**：levels/code、分壓功耗、雙向電流 offset。
- **SPI**：frame throughput、FIFO overrun、CPOL/CPHA/bit-order。

其他主題不以自動生成低品質題目填充；只有建立明確 misconception、variant 與 competency 後才加入 assessment。

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

- 本地 link/script/stylesheet/resource；
- curriculum 路徑與 JavaScript syntax；
- stable identity 與 V2/V3→V4 migration；
- evidence alias reconciliation；
- baseline/transfer/delayed-retention semantics；
- misconception 題庫品質；
- executable model registry 與工程 invariants；
- production dependency order；
- Chromium desktop/mobile smoke tests；
- simulator → machine evidence → matching worksheet 的跨頁流程；
- public-content 防呆。

## 維護原則

1. 一個正式工程量只有一個 canonical implementation。
2. 新 curriculum item 使用 explicit stable ID + competency。
3. 錯誤選項必須對應具體 misconception。
4. 新公式附 IO 單位、假設、失效條件、reference、version 與 test。
5. 不以完成頁數當能力；優先看 first-attempt transfer。
6. Heuristic 必須明確標示，不可冒充設計模型。
7. Legacy runtime 不進 production entry point。
8. Canonical source 必須可閱讀；minified output 只能由 build 產生。
