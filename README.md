# 電路模擬說明

> 🌐 線上教材：`https://linwuyen.github.io/Circuit-Simulation/`

這是一組純 HTML、CSS 與 JavaScript 的互動式電路、韌體與電力電子教材。根目錄的 `index.html` 是總入口，課程資料集中在 `assets/learning/curriculum.js`。

## 公開內容界線

此 repository 只放可公開的通用教材。任何公司專案、實際產品原理圖、內部型號、韌體快照、量測紀錄或未公開設計資料，都必須存放在獨立的 private repository，不得以隱藏連結、前端密碼或未列入導覽的目錄方式放在公開 Git 歷史中。

## 學習入口

| 頁面 | 用途 |
|---|---|
| `beginner.html` | 依「目標、操作、判讀」拆解每個主題。 |
| `labs.html` | 以工程任務與成功條件驅動學習。 |
| `troubleshooting.html` | 從症狀反查原因、確認方式與修法。 |
| `progress.html` | 查看完成率、下一步及匯出／匯入進度。 |
| `quiz.html` | 檢查現象、原因與成功條件是否能對應。 |
| `glossary.html` | 跨主題工程詞彙。 |
| `search.html` | 搜尋課程、實驗、故障與詞彙。 |
| `report.html` | 產生可交付的 Markdown 實驗紀錄。 |

## 工程模型界線

教材中的輸出分成兩類：

1. **公式計算**：由 `assets/learning/engineering-models.js` 的 pure functions 計算，並由 Node 測試驗證典型值與邊界條件。
2. **教學指標**：只用來呈現趨勢，畫面會明確標示為 heuristic／教學模型，不可直接用於元件選型、保護門檻、安全驗證或量產設計。

即使是公式計算，也必須確認拓撲、工作模式、元件 datasheet、控制器規格與實測條件。當 Buck 進入 DCM、ADC 飽和或輸入超出模型適用範圍時，頁面會顯示警告，而不是延用失效公式。

## 教材主題

課程清單由 `assets/learning/curriculum.js` 產生，包含 Buck、C2000 ADC、電力電子拓撲、FOC、PI、SPI、10 μs 控制迴路、F28388D BMS、AD5543、AFE、ACMC 與 C2000 DDS／電力測量。

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

GitHub Actions 會在 push 與 pull request 自動執行相同檢查，包括：

- 本地 `href`、`src` 與 CSS `url()` 是否缺檔。
- 課程資料中的入口、課程、實驗與故障連結是否存在。
- JavaScript 語法。
- 工程模型單元測試。
- 公開內容不得包含私人教材名稱或前端假密碼。

## 維護原則

- 新增課程時，優先更新 `assets/learning/curriculum.js`，不要在首頁複製另一份清單。
- 計算公式放在 `assets/learning/engineering-models.js`，UI 只負責輸入、顯示與警告。
- 新公式必須附適用條件、單位與至少一個單元測試。
- `legacy/` 與 `originals/` 只作歷史備查，不視為正式教材入口。