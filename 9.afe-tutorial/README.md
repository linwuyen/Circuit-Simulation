# AFE 教材整合包

這個資料夾把 AFE 雙向控制模擬器拆成可教學、可實驗、可回到完整模擬器的整合包。

## 入口

- `START_HERE.html`：整合包入口，適合交付給學員。
- `index.html`：課程地圖。
- `simulator.html`：教練版模擬器。
- `afe.html` / `simulator-core.html`：完整模擬器頁面。

## 建議順序

1. `01-concepts.html`：AFE 觀念地圖。
2. `02-waveforms.html`：波形判讀。
3. `03-control-loop.html`：控制迴路拆解。
4. `04-lab.html`：實驗工作台與紀錄匯出。
5. `simulator.html`：回到教練版完整操作。

## 共用檔案

- `assets/app.css`：課程頁共用樣式。
- `assets/app.js`：課程頁共用互動、紀錄與匯出邏輯。

第三方圖示與 Tailwind 腳本已改成本地 `../assets/vendor/` 引用，方便離線展示。
