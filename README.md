# 電路模擬說明

> 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

以「預測 → 操作 → 觀察 → 解釋 → 遷移」為核心的互動式電路、韌體與電力電子教材。成果不是看過多少頁，而是能否留下可驗證證據並處理未見過的工程情境。

## 公開內容界線

此 repository 只保存可公開的通用教材。公司專案、產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料不得進入公開 Git 歷史。

## 唯一正式 runtime：V3

所有 production entry pages 只載入：

```text
curriculum.js
      ↓
curriculum-schema-v3.js
      ↓
quiz-bank.js / model-registry.js / engineering-models.js
      ↓
learning-v3.js + learning-v3.css
      ↓
Home / Beginner / Labs / Troubleshooting / Progress / Quiz / Search / Report
```

- `curriculum-schema-v3.js` 是可閱讀、可 review 的 canonical schema source。
- `learning-v3.js` 是正式 learning state machine 與 renderer。
- Production pages 不得載入 `learning-v2.js` 或 `learning-v2.css`。
- V2 只保留作歷史比較與 progress migration 相容，不再接受新功能。
- CI 的 `runtime-version.test.mjs` 防止 V2 依賴或 minified canonical source 回流。

架構與 ownership 詳見 [`docs/runtime-architecture.md`](docs/runtime-architecture.md)。

## 學習閉環

每個完整實驗應留下：

1. 操作前預測：變數、方向與原因。
2. 單變因驗證：一次只改一項控制量。
3. 實際觀察：數值、波形、狀態與差異。
4. 因果解釋：公式、能量流或時序。
5. 模型限制：適用條件、忽略項與不確定性。
6. 遷移驗證：換參數或故障條件後重新判斷。

`report.html` 只有在 prediction、parameters、observation、explanation、limitations 與 transfer 品質條件通過後，才將工作升級為 evidence。

## 主要入口

| 頁面 | 用途 |
|---|---|
| `beginner.html` | 依能力標籤拆解課程，顯示模型假設與失效條件。 |
| `labs.html` | 工程任務與 evidence worksheet。 |
| `troubleshooting.html` | 症狀 → 假設 → 辨識性測試 → 修法。 |
| `progress.html` | 分開顯示操作證據與診斷證據。 |
| `quiz.html` | 迷思型干擾項與錯誤心智模型。 |
| `glossary.html` | 跨主題工程詞彙。 |
| `search.html` | 搜尋課程、實驗、故障與詞彙。 |
| `report.html` | 產生預測—驗證—解釋—遷移工作單。 |

## 標竿模組

- **Buck**：物理模型、CCM/DCM 邊界、漣波與元件應力。
- **ADC**：類比訊號鏈、量化、分壓功耗、飽和與 firmware scaling。
- **SPI**：frame timing、SCLK 吞吐、CPOL/CPHA、FIFO 與 ISR/DMA deadline。

其他主題仍可使用，但在完成 model card、迷思題庫與遷移題前，不以自動產生的低品質內容填充。

## 工程模型界線

教材輸出分為：

1. **公式計算**：pure functions，需案例與 invariant tests。
2. **教學指標**：只描述趨勢，必須標示 heuristic。

任何元件選型、保護門檻、安全驗證或量產設計，都必須回到 datasheet、控制器文件、實際電路與量測。

每個正式模型應具備：

- 模型類型；
- 輸入、輸出與單位；
- 適用假設與失效條件；
- 公式來源；
- 至少一個案例測試與一個 invariant test。

## 本機執行

```text
python -m http.server 8080
```

開啟 `http://localhost:8080/`。

## 驗證

需要 Node.js 18 以上：

```text
node tools/validate-project.mjs
node --test tests/*.test.mjs
```

GitHub Actions 驗證：

- 本地 link、script、stylesheet 與 CSS resource 是否缺檔；
- 課程入口、實驗與故障連結；
- JavaScript syntax；
- stable ID 與 progress migration；
- 迷思題庫品質；
- 模型案例與 invariants；
- public-content 防呆；
- production pages 僅使用 V3 runtime。

## 維護原則

1. 一個工程量只有一個 canonical implementation；UI 不複製公式。
2. 新課程使用 stable ID、competency 與明確路徑。
3. 每個錯誤選項對應具體迷思。
4. 新公式附單位、假設、失效條件、來源與測試。
5. 不以頁面數作為進度；優先提高標竿模組的可驗證學習成效。
6. Legacy code 不進 production entry point。
7. Canonical source 必須可閱讀；minified output 只能由 build 產生。
