# 電路模擬說明

> 🌐 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一套以「預測 → 操作 → 觀察 → 解釋 → 遷移」為核心的互動式電路、韌體與電力電子教材。專案的主要成果不是頁面瀏覽數，而是使用者能否處理一個沒有看過的新工程情境。

## 公開內容界線

此 repository 只放可公開的通用教材。任何公司專案、實際產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料，都必須存放在獨立的 private repository，不得以隱藏連結、前端密碼或未列入導覽的目錄方式放在公開 Git 歷史中。

## 學習閉環

每個完整實驗應留下以下證據：

1. **操作前預測**：改變哪個變數、結果往哪個方向、原因是什麼。
2. **單變因驗證**：一次只改一個控制量。
3. **實際觀察**：記錄數值、波形、狀態與預測差異。
4. **因果解釋**：用公式、能量流或時序解釋結果。
5. **模型限制**：列出適用條件、忽略項與不確定性。
6. **遷移驗證**：換一組參數或故障條件後重新判斷。

`report.html` 只有在預測、觀察、解釋與遷移欄位都完成後，才會將實驗標記為完成。

## 學習入口

| 頁面 | 用途 |
|---|---|
| `beginner.html` | 依能力標籤拆解課程，顯示模型假設與失效條件。 |
| `labs.html` | 以工程任務驅動工作單，不再用單一勾選代表完成。 |
| `troubleshooting.html` | 依「症狀 → 假設 → 辨識性測試 → 修法」除錯。 |
| `progress.html` | 分開顯示練習證據與診斷證據。 |
| `quiz.html` | 使用人工設計的迷思型干擾項，答錯時指出錯誤心智模型。 |
| `glossary.html` | 跨主題工程詞彙。 |
| `search.html` | 搜尋課程、實驗、故障與詞彙。 |
| `report.html` | 產生可交付的預測—驗證—解釋 Markdown 工作單。 |

## 第二代學習核心

- `assets/learning/curriculum.js`：原始課程內容資料。
- `assets/learning/curriculum-schema.js`：將舊陣列格式正規化為具名欄位、stable ID 與 competency。
- `assets/learning/learning-v2.js`：課程、實驗、測驗、進度與工作單的正式執行核心。
- `assets/learning/quiz-bank.js`：人工設計的迷思診斷題庫。
- `assets/learning/model-registry.js`：模型類型、假設、輸出、來源與失效條件。
- `assets/learning/engineering-models.js`：可獨立測試的 pure calculation functions。

舊版進度使用課程陣列 index；第二代會在首次載入時遷移成由檔案路徑與明確 ID 產生的 stable ID。之後重新排序課程，不會把既有進度指向另一頁。

## 標竿模組

目前優先把三個主題做成品質模板：

- **Buck**：物理模型、CCM/DCM 邊界、漣波與元件應力。
- **ADC**：類比訊號鏈、量化、分壓功耗、飽和與韌體 scaling。
- **SPI**：frame timing、SCLK 吞吐量、CPOL/CPHA、FIFO 與 ISR/DMA 服務期限。

其他主題仍可使用，但在完成 model card、迷思題庫與遷移題前，不會用自動產生的低品質測驗填充。

## 工程模型界線

教材輸出分成兩類：

1. **公式計算**：由 pure functions 計算，並以典型案例與不變條件測試驗證。
2. **教學指標**：只呈現趨勢，必須明確標示 heuristic，不可直接用於元件選型、保護門檻、安全驗證或量產設計。

每個正式模型應具備：

- 模型類型。
- 輸入與單位。
- 適用假設。
- 失效條件。
- 公式來源。
- 至少一個案例測試與一個 invariant test。

即使是公式計算，也必須以元件 datasheet、控制器文件與實測條件交叉驗證。

## 本機執行

大多數頁面可直接開啟。若瀏覽器限制本機檔案權限，可在根目錄執行：

```text
python -m http.server 8080
```

然後開啟 `http://localhost:8080/`。

## 驗證

需要 Node.js 18 以上：

```text
node tools/validate-project.mjs
node --test tests/*.test.mjs
```

GitHub Actions 會在 push 與 pull request 執行相同檢查，包括：

- 本地 `href`、`src` 與 CSS `url()` 是否缺檔。
- 課程入口、實驗與故障連結是否存在。
- JavaScript 語法。
- Stable ID 與舊進度遷移。
- 迷思題庫品質。
- 模型案例測試與 invariant tests。
- 公開內容防呆掃描。

## 維護原則

- 一個工程量只能有一個 canonical implementation；UI 不得自行複製公式。
- 新課程必須使用穩定 ID、competency 與明確路徑。
- 新測驗的每個錯誤選項都必須對應一個具體迷思。
- 新公式必須附單位、假設、失效條件、來源與測試。
- 不以新增頁面數作為進度；優先提高三個標竿模組的可驗證學習成效。
- `legacy/` 與 `originals/` 只作歷史備查，不視為正式教材入口。
