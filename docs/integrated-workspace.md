# 一台電路，一個學習工作台

本文件說明 **main 上目前的入口與版本邊界**。舊八課仍受支援，但不再是首頁預設的物理實驗；請勿把兩套練習、模型或完成紀錄混成同一份證據。

## 首頁預設：連續實驗（目前路線）

- `index.html` 或 `learn.html` 無 hash 時，由 `assets/learning/workspace-ui.js` 進入 `CircuitWorkspace.mountExperiment()`。
- `#experiment-<lessonId>` 繼續開啟相同的連續實驗。順序是 `energy → storage → demand → sensing → feedback → deadline → response → protection`。
- 同一台 Buck 電路持續保留元件、設定與操作紀錄，物理運算委派給 Model Registry 的 `generic-power-causal-kernel`，而不是首頁另寫一套公式。
- 每次實驗為了可比較，從 **零電流與零輸出電壓** 重跑相同的 16 ms。保留的是設定、模型版本與觀察紀錄，不是上一段的電感/電容能量 checkpoint，也不是真板即時波形。
- 每課先預測，再只改一個變數，觀察並說明原因，最後用 36 V 陌生條件驗證。要公平比較時，校正 sensor gain 與恢復 timing budget 是使用者可見的獨立步驟，不能默默重設。
- 首次錯誤答案保留；單純開啟頁面或拖動控制項不授予正式完成。連續實驗紀錄存在 Evidence V5 下的 `benchmark.learningWorkspace.experiment`，不會升級舊八課或正式測驗的成績。
- 完整假設、ownership 與回退請參考 `docs/continuous-workbench.md`。

## 舊八課：相容入口（非預設連續實驗）

- `index.html#duty`、`#inductor`、`#load`、`#probe`、`#timing`、`#error`、`#adjust`、`#overshoot` 仍使用原本的教材規則與紀錄。
- 舊路線前五課與自由探索使用原本 `CircuitTrainingExperiments` 的理想 Buck 模型；後三課是明示為示意的數字修正規則，並非完整閉環物理模擬。
- 舊紀錄維持 `benchmark.beginnerLessons` / `benchmark.bridgeLessons` 的首次作答、觀察、原因與 transfer；新連續實驗不會自動視為舊課完成，反之亦然。
- 舊課的同頁 SVG、自由探索、延伸教材、備份相容及首次作答保留行為依然受支援。

## 跨拓樸比較與應用

- `index.html#topology` / `learn.html#topology`：明確取用合格的手動實驗設定，轉換到 SI 單位，比較 Buck/Boost **CCM 穩態**與 Boost RHP 零點。只共用可相容的參數；不傳遞控制器積分器、故障狀態或儲能。
- Module 17 提供 PFC、PSFB、LLC、Inverter 的四個定界練習，使用各自的模型與獨立條件；不是將 Buck 參數隱式套進所有拓樸，也不是雙向電源或實板認證。
- 跨拓樸操作、固定練習與正式獨立測驗各自保存證據。來源：`docs/topology-workbench.md` 與 `docs/topology-applications.md`。

## 模型、進度與安全邊界

- 各種量測、控制、動態、切換與保護展示是 `generic-power-causal-kernel` 的教學模型。它不是完整的器件損耗、熱、真實磁性元件、校準與實板量測模型。
- 所有練習都使用既有 Evidence V5 與 Unified Learning 的讀取／進度規則；不因為頁面完成就授予 `BOARD_PASS`、控制驗證 PASS 或真人學習成效。
- 保存失敗時應提示學員下載備份。遇到無法理解的較新學習紀錄版本時，應保持 fail-closed，而非靜默覆寫。

## 回歸檢查

- 新入口及連續實驗：`tests/continuous-course.test.mjs`、`tests/e2e/continuous-workspace.spec.js`。
- 舊八課與備份相容：`tests/e2e/workspace.spec.js` 及既有 Evidence 測試。
- Buck/Boost 比較：`tests/e2e/topology-workspace.spec.js`。
- 需要在 exact-head 上執行 `npm test` 與 `npm run test:e2e` 才能聲稱回歸 PASS；文件列出的測試檔名本身不構成執行證據。
