param(
  [switch]$SkipNodeCheck
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Section($Text) {
  Write-Host ""
  Write-Host "== $Text =="
}

Write-Section "Local href/src targets"
$missing = @()
Get-ChildItem -Recurse -Filter *.html | ForEach-Object {
  $file = $_.FullName
  $dir = Split-Path -Parent $file
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $file
  [regex]::Matches($text, '(?:href|src)\s*=\s*["'']([^"'']+)["'']', 'IgnoreCase') | ForEach-Object {
    $ref = $_.Groups[1].Value.Trim()
    if ($ref -match '^(#|javascript:|mailto:|tel:|data:|blob:|https?://)') { return }
    $clean = ($ref -split '[?#]')[0]
    if ([string]::IsNullOrWhiteSpace($clean)) { return }
    if (-not (Test-Path -LiteralPath (Join-Path $dir $clean))) {
      $missing += [pscustomobject]@{ File = $file.Substring($root.Length + 1); Ref = $ref }
    }
  }
}
if ($missing.Count) {
  $missing | Format-Table -AutoSize -Wrap
  throw "Missing local href/src targets: $($missing.Count)"
}
Write-Host "OK"

Write-Section "Dynamic curriculum refs"
$nodeScript = @'
const fs = require("fs");
const path = require("path");
global.window = global;
require(path.join(process.cwd(), "assets/learning/curriculum.js"));
const mods = global.CircuitCurriculum.modules;
const refs = [];
for (const m of mods) {
  refs.push([m.id, "entry", m.entry]);
  const base = m.entry.replace(/[^/]+$/, "");
  for (const l of m.lessons) refs.push([m.id, "lesson", base + l[0]]);
  for (const l of m.labs) refs.push([m.id, "lab", l[2]]);
  for (const f of m.faults) refs.push([m.id, "fault", f[4]]);
}
const missing = refs.filter(([, , ref]) => !fs.existsSync(path.join(process.cwd(), ref)));
if (missing.length) {
  for (const row of missing) console.log(row.join("\t"));
  process.exit(1);
}
console.log(`OK ${refs.length}`);
'@
$tmp = Join-Path $env:TEMP "validate-circuit-curriculum.js"
Set-Content -Encoding UTF8 -LiteralPath $tmp -Value $nodeScript
node $tmp
if ($LASTEXITCODE -ne 0) { throw "Dynamic curriculum refs failed" }

if (-not $SkipNodeCheck) {
  Write-Section "Standalone JS syntax"
  $jsErrors = @()
  Get-ChildItem -Recurse -Filter *.js | ForEach-Object {
    $out = & node --check $_.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
      $jsErrors += [pscustomobject]@{ File = $_.FullName.Substring($root.Length + 1); Error = ($out -join "`n") }
    }
  }
  if ($jsErrors.Count) {
    $jsErrors | Format-List
    throw "JS syntax errors: $($jsErrors.Count)"
  }
  Write-Host "OK"
}

Write-Section "Tutor injection"
$formalPages = Get-ChildItem -Recurse -File -Filter *.html | Where-Object {
  $rel = $_.FullName.Substring($root.Length + 1)
  $rel -match '^(0_buck_converter_|1_c2000_adc_calculator|2_code_artifact|3_foc_course|4_PI|5_spi|6\.10μs 高頻控制迴路模擬器|7\.28388d_bms_tutorial|8\.ad5543_simulator|9\.afe-tutorial|10\.acmc-pro_power_simulator|11\.c2000_dds_dashboard)\\' -and
  $rel -notmatch '\\legacy\\|\\originals\\'
}
$missingTutor = @()
foreach ($page in $formalPages) {
  $text = Get-Content -Raw -Encoding UTF8 -LiteralPath $page.FullName
  if ($text -notmatch 'data-circuit-tutor-css' -or $text -notmatch 'data-circuit-tutor-js') {
    $missingTutor += $page.FullName.Substring($root.Length + 1)
  }
}
if ($missingTutor.Count) {
  $missingTutor | ForEach-Object { Write-Host $_ }
  throw "Formal pages missing tutor injection: $($missingTutor.Count)"
}
Write-Host "OK $($formalPages.Count)"

Write-Section "Done"
Write-Host "All checks passed."
