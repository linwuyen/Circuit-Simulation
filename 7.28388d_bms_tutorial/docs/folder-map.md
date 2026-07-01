# Folder Map

```text
28388d_bms_tutorial/
  START_HERE.html         # 入口,跳轉到 index.html
  index.html              # 教學首頁(九章卡片)
  01_overview.html        # 總覽:因果鏈
  02_sense.html           # 量測 · AFE
  03_compare.html         # 比較 · 安全門檻
  04_decide.html          # 決定 · BMS 狀態機
  05_actuate.html         # 致動 · 接觸器與預充
  06_report.html          # 回報 · CAN/UDS
  07_coordinate.html      # 協同 · 多核與 IPC
  08_failsafe.html        # 失效安全 · 故障注入
  09_integrate.html       # 整合實驗
  open-course.bat
  README.md
  assets/
    bms-tutorial.css
    bms-sim.js
    bms-learn.js
  docs/
    folder-map.md
    teaching-guide.md
  legacy/
    tms320f28388d_bms.html        # 三核心完整模擬器(自包含)
    tms320f28388d_bms_original.html
    28388d_bms_original.html      # 原始單頁模擬器
    28388d_bms.html               # 舊轉址頁
    index2.html / START_HERE2.html # 舊入口
```

## 第一性原理拆解軸

照「一顆量測值走過的因果鏈」分章,而不是照硬體積木(CPU1/CPU2/CM4):

```text
量測 → 比較 → 決定 → 致動 → 回報
   (02)   (03)   (04)   (05)   (06)
        底層基礎:協同/IPC (07)
        安全出口:失效鎖定 (08)
        全鏈串接:整合實驗 (09)
```

## Integration Notes

- `START_HERE.html` 是入口,自動跳到 `index.html`。
- `01` 到 `09` 是依因果鏈遞進的課程頁。
- `09_integrate.html` 是把整條鏈串起來的整合視圖。
- `assets/` 是共用 CSS / JS;`bms-learn.js` 的 `CHAPTERS` 已對應九章。
- `legacy/` 封存舊世代與重複入口,不影響正式教材;其中三核心完整模擬器為自包含單檔。
