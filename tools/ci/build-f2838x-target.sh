#!/usr/bin/env bash
set -euo pipefail

: "${C2000_CGT_ROOT:?Set C2000_CGT_ROOT to a TI C2000 CGT installation}"
: "${C2000WARE_ROOT:?Set C2000WARE_ROOT to C2000Ware core SDK}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FIRMWARE_DIR="${REPO_ROOT}/19_c2000_buck_firmware_lab/firmware"
COMMON_INCLUDE="${C2000WARE_ROOT}/device_support/f2838x/common/include"
DRIVERLIB_INCLUDE="${C2000WARE_ROOT}/driverlib/f2838x/driverlib"
OUT_DIR="${RUNNER_TEMP:-/tmp}/c2000-target-objects"
CL2000="${C2000_CGT_ROOT}/bin/cl2000"

for required in "${CL2000}" "${COMMON_INCLUDE}/device.h" "${DRIVERLIB_INCLUDE}/epwm.h"; do
  if [[ ! -e "${required}" ]]; then
    echo "Missing target-build dependency: ${required}" >&2
    exit 1
  fi
done

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}"

COMMON_FLAGS=(
  --compile_only
  --abi=eabi
  --silicon_version=28
  --float_support=fpu32
  --tmu_support=tmu0
  --vcu_support=vcu2
  --define=CPU1
  --include_path="${C2000_CGT_ROOT}/include"
  --include_path="${COMMON_INCLUDE}"
  --include_path="${DRIVERLIB_INCLUDE}"
  --include_path="${FIRMWARE_DIR}"
)

pushd "${OUT_DIR}" >/dev/null
"${CL2000}" "${COMMON_FLAGS[@]}" "${FIRMWARE_DIR}/buck_control.c"
"${CL2000}" "${COMMON_FLAGS[@]}" "${FIRMWARE_DIR}/f2838x_target.c"
popd >/dev/null

for object in buck_control.obj f2838x_target.obj; do
  if [[ ! -s "${OUT_DIR}/${object}" ]]; then
    echo "TI target compile did not produce ${object}" >&2
    exit 1
  fi
done

echo "TI C2000 target compile PASS"
echo "  compiler: $(${CL2000} --version | head -n 1)"
echo "  C2000Ware: ${C2000WARE_ROOT}"
echo "  objects: ${OUT_DIR}/buck_control.obj ${OUT_DIR}/f2838x_target.obj"
