# SPI 初學者互動課程

打開 `index.html` 作為入口。9 堂課，一堂一個觀念，每課都有
「一句話先懂 → 生活比喻 → 動手模擬 → 常見錯誤 → 自我檢查」。

## 課程頁面（新版）

| 階段 | 檔案 | 內容 |
|---|---|---|
| 入口 | `index.html` | 課程入口、學習路線、術語表 |
| A 先有畫面 | `lesson_00_what.html` | SPI 是什麼、何時用（對比 UART / I²C） |
| | `lesson_01_wires.html` | 四條線角色與接線（含多 Slave） |
| | `lesson_02_fullduplex.html` | 全雙工：一個 bit 換一個 bit |
| B 搞懂時序 | `lesson_03_clock.html` | clock 怎麼推資料、取樣邊緣 |
| | `lesson_04_mode.html` | CPOL/CPHA 四模式、setup margin |
| C 資料量大 | `lesson_05_fifo_why.html` | 為什麼需要 FIFO（水桶比喻） |
| | `lesson_06_overrun.html` | overrun 壓力測試（FIFO / ISR / DMA） |
| D 動手實務 | `lesson_07_wiring.html` | 接線與常見硬體錯誤、可複製程式碼 |
| | `lesson_08_debug.html` | 症狀 → 原因除錯表 |

## 共用檔案

- `assets/spi.css`：所有頁面共用的設計系統（顏色、版面、元件）。改這裡可一次改全部。
- `assets/spi-lesson.js`：共用導覽列、上一課/下一課、自我檢查 quiz、程式碼分頁。

## 使用方式

純 HTML/CSS/JavaScript。直接雙擊 `index.html`，或用瀏覽器開啟即可，
不需安裝套件或啟動伺服器。

## 舊版檔案（已被新版取代，保留備查）

- `spi_01_signals.html`、`spi_02_timing.html`、`spi_fifo.html`、`spi_04_debug.html`、`spi_index.html`
- `originals/spi_fifo.original.html`、`originals/spi_fifo_gemini_backup.html`

新版的內容已涵蓋並拆細這些舊頁，可在確認新版無誤後自行刪除舊檔。

## 注意

實機暫存器名稱與清旗順序仍以你的晶片 TRM（C2000 等）為準。
