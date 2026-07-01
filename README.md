# 電路模擬說明

這個資料夾是一組純 HTML/CSS/JavaScript 的互動式電路與韌體教學教材。根目錄的 `index.html` 是總入口，各子資料夾保留自己的課程入口與模擬器。

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

## 維護狀態

- 正式教材的主要外部腳本已複製到 `assets/vendor/`，方便離線使用。
- `legacy/` 與 `originals/` 代表封存或備份內容，不是主要學習入口。
- 這個資料夾已可用 Git 管理；第三方 vendor 檔案保留在版本控制內，因為它們支援離線開啟。

## 快速檢查

可用下面的 PowerShell 檢查本地 `href/src` 是否缺檔：

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
