#!/usr/bin/env bash
set -euo pipefail

CGT_VERSION="25.11.1.LTS"
CGT_URL="https://dr-download.ti.com/software-development/ide-configuration-compiler-or-debugger/MD-xqxJ05PLfM/25.11.1.LTS/ti_cgt_c2000_25.11.1.LTS_linux-x64_installer.bin"
PREFIX="${C2000_CGT_INSTALL_PREFIX:-${RUNNER_TEMP:-/tmp}/ti-cgt-c2000-${CGT_VERSION}}"
INSTALLER="${RUNNER_TEMP:-/tmp}/ti_cgt_c2000_${CGT_VERSION}.bin"

if [[ ! -x "${PREFIX}/bin/cl2000" ]]; then
  echo "Installing TI C2000 CGT ${CGT_VERSION} into ${PREFIX}"
  curl --fail --location --retry 4 --retry-delay 2 "${CGT_URL}" -o "${INSTALLER}"
  chmod +x "${INSTALLER}"
  "${INSTALLER}" --mode unattended --prefix "${PREFIX}"
fi

CL2000="$(find "${PREFIX}" -type f -name cl2000 -perm -111 -print -quit)"
if [[ -z "${CL2000}" ]]; then
  echo "cl2000 was not found after installing ${CGT_VERSION}" >&2
  exit 1
fi

CGT_ROOT="$(cd "$(dirname "${CL2000}")/.." && pwd)"
"${CL2000}" --version

if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "C2000_CGT_ROOT=${CGT_ROOT}" >> "${GITHUB_ENV}"
else
  echo "C2000_CGT_ROOT=${CGT_ROOT}"
fi
