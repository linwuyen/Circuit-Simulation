#!/usr/bin/env bash
set -euo pipefail

: "${C2000_CGT_ROOT:?Set C2000_CGT_ROOT to a TI C2000 CGT installation}"
: "${C2000WARE_ROOT:?Set C2000WARE_ROOT to C2000Ware core SDK}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIRMWARE_DIR="${REPO_ROOT}/19_c2000_buck_firmware_lab/firmware"
COMMON_ROOT="${C2000WARE_ROOT}/device_support/f2838x/common"
DRIVERLIB_ROOT="${C2000WARE_ROOT}/driverlib/f2838x/driverlib"
OUT_DIR="${REPO_ROOT}/build/f2838x-flash"
CL2000="${C2000_CGT_ROOT}/bin/cl2000"
HEX2000="${C2000_CGT_ROOT}/bin/hex2000"
LINKER_CMD="${COMMON_ROOT}/cmd/2838x_FLASH_lnk_cpu1.cmd"
DRIVERLIB="${DRIVERLIB_ROOT}/ccs/Release/driverlib.lib"
DEVICE_C="${COMMON_ROOT}/source/device.c"
CODESTART="${COMMON_ROOT}/source/f2838x_codestartbranch.asm"

for required in \
  "${CL2000}" "${HEX2000}" "${LINKER_CMD}" "${DRIVERLIB}" \
  "${DEVICE_C}" "${CODESTART}" "${COMMON_ROOT}/include/device.h" "${COMMON_ROOT}/include/driverlib.h"; do
  if [[ ! -e "${required}" ]]; then
    echo "Missing image-build dependency: ${required}" >&2
    exit 1
  fi
done

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

COMMON_FLAGS=(
  --abi=eabi
  --silicon_version=28
  --float_support=fpu32
  --tmu_support=tmu0
  --vcu_support=vcu2
  --define=CPU1
  --define=_FLASH
  --include_path="${C2000_CGT_ROOT}/include"
  --include_path="${COMMON_ROOT}/include"
  --include_path="${DRIVERLIB_ROOT}"
  --include_path="${FIRMWARE_DIR}"
  --diag_warning=225
  --display_error_number
)

pushd "${OUT_DIR}" >/dev/null
"${CL2000}" "${COMMON_FLAGS[@]}" --compile_only "${FIRMWARE_DIR}/buck_control.c"
"${CL2000}" "${COMMON_FLAGS[@]}" --compile_only "${FIRMWARE_DIR}/f2838x_target.c"
"${CL2000}" "${COMMON_FLAGS[@]}" --compile_only "${DEVICE_C}"
"${CL2000}" "${COMMON_FLAGS[@]}" --compile_only "${CODESTART}"

"${CL2000}" "${COMMON_FLAGS[@]}" \
  --run_linker \
  --entry_point=code_start \
  --rom_model \
  --stack_size=0x3F8 \
  --warn_sections \
  --reread_libs \
  --map_file=c2000-buck-f2838x.map \
  --output_file=c2000-buck-f2838x.out \
  buck_control.obj f2838x_target.obj device.obj f2838x_codestartbranch.obj \
  "${LINKER_CMD}" "${DRIVERLIB}" --library=libc.a

"${HEX2000}" -i c2000-buck-f2838x.out -o c2000-buck-f2838x.hex -romwidth 16 -memwidth 16
popd >/dev/null

for artifact in c2000-buck-f2838x.out c2000-buck-f2838x.map c2000-buck-f2838x.hex; do
  if [[ ! -s "${OUT_DIR}/${artifact}" ]]; then
    echo "Image build did not produce ${artifact}" >&2
    exit 1
  fi
done

if ! grep -q "codestart" "${OUT_DIR}/c2000-buck-f2838x.map"; then
  echo "Link map is missing codestart; flash boot image is not valid" >&2
  exit 1
fi
if ! grep -q "080000" "${OUT_DIR}/c2000-buck-f2838x.map"; then
  echo "Link map does not show the F2838x flash entry region 0x080000" >&2
  exit 1
fi

echo "TI C2000 F2838x flash image PASS"
echo "  out: ${OUT_DIR}/c2000-buck-f2838x.out"
echo "  map: ${OUT_DIR}/c2000-buck-f2838x.map"
echo "  hex: ${OUT_DIR}/c2000-buck-f2838x.hex"
