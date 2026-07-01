# F28388D BMS 教學模擬器

用「第一性原理」把一個資訊量很大的 BMS 模擬器,拆成初學者能一步一步操作的課程。

核心觀念:**一顆量測值會走過一條固定的因果鏈**——

> 量測 → 比較 → 決定 → 致動 → 回報,底下墊著「跨核協同」,任一步判定危險就進入 FAULT_LOCK。

每一頁只學鏈上的一個環節。硬體核心(CPU1 / CPU2 / CM4)只是每環「實際由誰執行」的標籤,不是學習主軸。

## 怎麼開始

直接用瀏覽器開 `START_HERE.html`(會自動跳到 `index.html`)。

## 資料夾結構

```text
28388d_bms_tutorial/
  START_HERE.html         # 入口,跳轉到 index.html
  index.html              # 教學首頁(九章卡片)
  01_overview.html        # 總覽:把系統看成一條因果鏈
  02_sense.html           # 量測:AFE 感測(鏈①)
  03_compare.html         # 比較:安全門檻(鏈②)
  04_decide.html          # 決定:BMS 狀態機(鏈③)
  05_actuate.html         # 致動:接觸器與預充(鏈④)
  06_report.html          # 回報:CAN/UDS 診斷(鏈⑤)
  07_coordinate.html      # 協同:多核與 IPC(基礎層)
  08_failsafe.html        # 失效安全:故障注入
  09_integrate.html       # 整合實驗:把整條鏈串成測試案例
  assets/
    bms-tutorial.css      # 共用樣式
    bms-sim.js            # 共用模擬邏輯(各章模擬器,共用 limits/狀態)
    bms-learn.js          # 共用教學增強層(進度/詞彙/任務/小測/匯出)
  docs/
    folder-map.md
    teaching-guide.md
  legacy/                 # 封存:不影響正式教材
    tms320f28388d_bms.html        # 三核心完整模擬器(自包含,進階對照用)
    28388d_bms_original.html      # 原始單頁模擬器
```

## 建議使用方式

1. 從 `START_HERE.html` 開始。
2. 按 01 → 09 的順序操作,每頁只改一個輸入、看一個結果、讀懂原因。
3. 完成 `09_integrate.html` 後,再回首頁開 `legacy/tms320f28388d_bms.html` 完整模擬器對照。

## 每頁的固定教學骨架

- 一句話點出本頁要回答的問題。
- 先記住的幾個門檻 / 數字。
- 一個「只改一個輸入」的互動模擬器。
- 真實韌體錨點(對應暫存器 / `#define` / UDS SID)。
- 「如果這是你的車」的生活化後果。
- 帶走的三句話總結。

## 每頁都有的學習輔助(bms-learn.js)

- **學習進度條**:頂部九個圓點顯示目前章節與已完成章節,進度記在瀏覽器 localStorage。
- **FSM 即時狀態圖**:狀態頁用 SVG 畫出 INIT→STANDBY→DISCHARGE→FAULT_LOCK,目前狀態即時高亮,最近一次轉換的箭頭會脈動(過壓/過流走紅色邊)。
- **任務驗收**:每頁底部的任務會在你操作達標時自動打勾;全部完成即標記該章完成。
- **自我檢查小測**:三題即時對答案,答對全部也會標記完成。
- **名詞 tooltip + 詞彙表**:文中專有名詞(AFE、IPC、UDS、預充…)滑過去有白話解釋,右下角「詞彙表」可一次查全部。
- **真實對應註解**:技術頁加上「這對應到哪個暫存器 / #define / UDS SID」,把模擬連回真實韌體。
- **可操作的 UDS 棧(06 章)**:支援 `10/11/3E/22/27/31` 服務、session 與安全存取(seed → key)門檻,以及 `11/12/22/31/33/35` 等真實 NRC 負回應;練習順序 `10 03 → 27 01 → 27 02 C3 D4 E5 F6 → 31 01`。
- **事件紀錄匯出**:事件 log 與 UDS 終端機可一鍵匯出成 .txt,當作學習紀錄或報告附件。

## 本機預覽(可選)

純 HTML,直接用瀏覽器開即可。若要用本機伺服器避免路徑問題:

```text
python -m http.server 8388
```

然後開 `http://localhost:8388/START_HERE.html`。(已附 `.claude/launch.json` 給編輯器的預覽面板使用。)

## 教學重點

- AFE 只提供感測輸入,不負責最終安全決策。
- 比較層是無狀態純函式:輸入相同,判定就相同;判斷與動作要分離。
- 致動前一定要先預充,用電阻限突波,電容達約 95% 才閉合主正。
- CM4 負責 CAN FD / UDS 診斷通訊;讀懂 7F + NRC 就知道為何被拒絕。
- FAULT_LOCK 應視為鎖定狀態,不能默默自動恢復。
