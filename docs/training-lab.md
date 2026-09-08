# 電子實作訓練：操作、重播與真人試用

沿用 Module 15 / Module 19、V5 evidence 與既有正式 PRE/POST/retention，不建立新的課程或實板認證框架。

## 學員流程

1. Module 19 完成正常因果链與 PRE。
2. System Lab 下方進阶實驗：固定 duty，將負載由 5 Ω 提高至 100 Ω，觀察 CCM→DCM、零電流區間與輸出。
3. 每次只改探棒倍率、取樣率、頻寬或觸發其中一項，分辨電路真值與畫面。
4. 保存原始／變因／修正三組對照，JSON 可匯入另一台瀏覽器重播。
5. 按物理方向、單位、時序、模型邊界做短實驗，換參數或表示方式再次驗證。原首答保留。
6. Multi-fault Lab 下方進入盲測維修：五次量測、兩個根因、至少兩項 evidence 引用。先鎖定首判，再逐項修正。
7. 檢查原工況與陌生工況的輸出、時序、資料新鮮度、保護及峰值電流；完成 POST 與原有 1/7/30/90 天取回。

## 模型與來源

固定 duty 二極體 Buck：K=2Lfs/R，臨界 K=1-D。CCM 使用 M=Vout/Vin=D；DCM 由 K·M²=D²(1-M) 得 M=2D/(D+sqrt(D²+4K))。
ON/OFF 斜率與零電流區間共同產生波形。ESR 只加入小漣波估算；漣波大於平均輸出 10% 時標為超出小漣波假設。
此穩態模型不包含閉環、磁滯、溫升或开關器件損耗。
來源：[TI SLVA057](https://www.ti.com/lit/an/slva057/slva057.pdf)。測試另外核對電流守恆、CCM/DCM 接續與參數變形。

量測路徑為 1 V/A 轉換器、實際探棒衰減、一階類比低通、10-bit ±5 V ADC、示波器倍率設定。
觸發為顯示通道的上升沿；無交越時明示自由運行。基頻 Nyquist 條件不是任意波形全部諧波的充分條件。
來源：[Tektronix aliasing](https://www.tek.com/en/support/faqs/what-aliasing-and-how-do-i-detect-it-and-fix-it-my-oscilloscope)、[bandwidth and sample rate](https://www.tek.com/en/documents/primer/evaluating-oscilloscopes)。

原有閉環 System Lab 另提供可選 DCR 與微分電感飽和曲線：Ldiff=L0·[r+(1-r)/(1+(i/Iknee)^4)]，Iknee=0 時關閉。
這是指定的因果教學曲線，不是材料 B-H 曲線，不提供磁芯選型、磁滯、損耗或溫升認證。預設關閉，維持舊案例行為。

## 維修結果界線

修正會移除所選故障並重新執行現有 system kernel。
原工況 Vin=80 V、最終負載 6 Ω、最終命令 36 V；新工況按 seed 改變 Vin/負載，命令改成 32 V。
健康參考與故障機器使用同一個模型，因此驗證僅為 practice，不是 independent-oracle A 級或 BOARD_PASS。
提交前不回饋對錯，首判不能改寫。看答案、重播、同 seed 重開都不計首次獨立完成；公開瀏覽器教材不是防作弊考試平台。

## 重播與完整備份

- 實驗 JSON 包含模型版本、初始設定、最多 100 個操作、最多三個快照及波形。匯入重新計算，忽略外部 metrics。
- 維修 JSON 包含 model/engine 版本、seed、最多 20 個操作；重播重新執行量測及驗證。
- V5 `benchmark.trainingPractice` 保存最近 12 份詳細紀錄。較小的 `studySessions` 統計另行保留，詳細檔淘汰不會移除統計。
- 完整備份仍為 V5 JSON，增加 `auxiliary.coreFlow`。有主線進度的備份在實驗頁還原；既有 V5 格式仍可匯入。
- 合併以本機首答為先，不可將錯誤首答換成正確。主線完成需有對應 prediction/remediation 與 interaction。
- 任一儲存寫入失敗都顯示共同提示；保留待寫入內容、可重試或匯出。損壞原文先存入 `-corrupt-backup`，該備份失敗時不覆蓋原文。
- 尚未寫入的記憶體內容仍可能在關閉/重新整理後遺失，沒有雲端自動上傳。

## 主持人可直接使用的真人試用方案

先招募不同經驗的自願學員做小規模可用性試用；人數少時不宣稱教學成效。使用隨機匿名代碼，不收姓名、Email 或公司設計。
每人依序 PRE→同一主線→一個未見維修案例→POST→到期 retention。首判前不給答案；要求提示時由 reveal 記錄，保留練習但不計獨立完成。

學員勾選同意後，自行下載並交付匿名實作統計。資料只含計數、時間彙總、錯題類別，不含題目、答案、實驗檔或自由文字；沒有真人操作就沒有成績。

```sh
node tools/learning/summarize-training-pilot.mjs p-a.training-pilot.json p-b.training-pilot.json
```

分析器拒絕重複 ID、不相容版本與非法分母；同時列學員數、案例數、未評分案例與提示使用。揭露答案的案例不加入獨立首判準確率。
正式 PRE/POST/retention 仍用 `summarize-outcome-study.mjs`，不把實作與正式測驗混成單一分數。
先用錯題類別與提示依賴找教材問題，再以新的未見案例驗證。所有輸出固定 `causalClaimAllowed:false`，真正因果效果需另外的研究設計。

## 驗證入口

- `tests/training-experiments.test.mjs`：模型邊界、守恆、量測失真與重播。
- `tests/repair-training.test.mjs`：首判、預算、真實修正、新工況與揭露。
- `tests/training-storage.test.mjs`：兩套儲存失敗、恢復與首答保留。
- `tests/training-pilot.test.mjs`：匿名 allowlist、缺失資料、分母。
- `tests/e2e/training-lab.spec.js`：表單、SVG、匯入/匯出、備份、手機版。

正式測驗備份：全新裝置還原完整 outcomeV1（含 PRE/POST/retention）。若本機已有正式首答，保留本機整份 protocol，外來版本保存在 outcomeBackupArchives，並在匯入結果明示；不混合不同 seed 或快取成績。
