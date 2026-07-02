# 電路模擬說明

這個資料夾是一組純 HTML/CSS/JavaScript 的互動式電路與韌體教學教材。根目錄的 `index.html` 是總入口，各子資料夾保留自己的課程入口與模擬器。

## 建議學習模式

初學者不要一開始直接打開完整模擬器。建議先用根目錄新增的教學入口：

| 頁面 | 用途 |
|---|---|
| `beginner.html` | 初學者拆解路線：每個主題用一句話、生活比喻、最小操作、判讀與實務用途拆開。 |
| `labs.html` | 實用實驗任務：用工程任務驅動操作，包含成功條件與實務用途。 |
| `troubleshooting.html` | 故障速查表：從症狀反查原因、確認方式與修法。 |
| `glossary.html` | 全域詞彙表：集中解釋跨主題關鍵字。 |
| `search.html` | 全域搜尋：搜尋課程、實驗、故障、詞彙與實務提示。 |
| `report.html` | 實驗報告產生器：把任務、參數、觀察與結論產生 Markdown 紀錄。 |

這些頁面的資料來源在 `assets/learning/curriculum.js`。之後要新增任務、故障案例或調整教學順序，優先改這個資料檔。

正式教材頁面也注入了頁內教學助手：

- `assets/learning/tutor.css`
- `assets/learning/tutor.js`

助手會依目前頁面路徑自動顯示該頁的教學目標、操作步驟、判讀方式、相關故障、詞彙與報告入口。`legacy/` 與 `originals/` 預設不注入。

## 使用方式

直接用瀏覽器開啟 `index.html`。大多數教材不需要安裝套件或啟動伺服器；若瀏覽器對本機檔案權限較嚴格，可在根目錄執行：

```text
python -m http.server 8080
```

然後開 `http://localhost:8080/`。

## 教材入口

| 編號 | 主題 | 入口 |
|---|---|---|
| 0 | Buck 降壓轉換器 | `0_buck_converter_/index.html` |
| 1 | C2000 ADC 參數計算 | `1_c2000_adc_calculator/index.html` |
| 2 | 電力電子拓撲 / 逆變器 | `2_code_artifact/index.html` |
| 3 | FOC 從零到診斷 | `3_foc_course/index.html` |
| 4 | PI 控制器波德圖 | `4_PI/index.html` |
| 5 | SPI 初學者課程 | `5_spi/index.html` |
| 6 | 10μs 高頻控制迴路 | `6.10μs 高頻控制迴路模擬器/index.html` |
| 7 | F28388D BMS 教學 | `7.28388d_bms_tutorial/START_HERE.html` |
| 8 | AD5543 DAC 教學 | `8.ad5543_simulator/index.html` |
| 9 | AFE 入門拆解 | `9.afe-tutorial/START_HERE.html` |
| 10 | ACMC-PRO 雙迴路控制逆變器 | `10.acmc-pro_power_simulator/index.html` |
| 11 | C2000 電力測量與 DDS 儀表板 | `11.c2000_dds_dashboard/index.html` |

## 維護狀態

- 正式教材的主要外部腳本已複製到 `assets/vendor/`，方便離線使用。
- 新增的教學框架位於 `assets/learning/`，負責初學路線、實驗任務、故障速查、搜尋、詞彙表、頁內教學助手與報告產生器。
- `legacy/` 與 `originals/` 代表封存或備份內容，不是主要學習入口。
- 這個資料夾已可用 Git 管理；第三方 vendor 檔案保留在版本控制內，因為它們支援離線開啟。

## 快速檢查

建議直接執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\validate-project.ps1
```

這會檢查：

- 本地 `href/src` 是否缺檔。
- `assets/learning/curriculum.js` 裡的動態連結是否存在。
- 獨立 JavaScript 語法。
- 正式教材頁是否已注入頁內教學助手。

若只想手動檢查本地 `href/src` 是否缺檔，也可用下面的 PowerShell：

```powershell
$root = (Get-Location).Path
Get-ChildItem -Recurse -Filter *.html | ForEach-Object {
  $file = $_.FullName
  $dir = Split-Path -Parent $file
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $file
  [regex]::Matches($text, '(?:href|src)\s*=\s*["'']([^"'']+)["'']', 'IgnoreCase') |
    ForEach-Object {
      $ref = $_.Groups[1].Value
      if ($ref -match '^(#|javascript:|mailto:|tel:|data:|blob:|https?://)') { return }
      $clean = ($ref -split '[?#]')[0]
      if ($clean -and -not (Test-Path -LiteralPath (Join-Path $dir $clean))) {
        [pscustomobject]@{ File = $file.Substring($root.Length + 1); Ref = $ref }
      }
    }
}
```
