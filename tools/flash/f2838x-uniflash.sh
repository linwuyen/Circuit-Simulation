#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${F2838X_IMAGE:-${REPO_ROOT}/build/f2838x-flash/c2000-buck-f2838x.out}"
CCXML="${F2838X_CCXML:-}"
UFSETTINGS="${F2838X_UFSETTINGS:-}"
DSLITE="${DSLITE:-}"

usage() {
  cat <<'EOF'
Usage:
  DSLITE=/path/to/dslite.sh \
  F2838X_CCXML=/path/to/board.ccxml \
  [F2838X_UFSETTINGS=/path/to/generated.ufsettings] \
  [F2838X_IMAGE=/path/to/c2000-buck-f2838x.out] \
  bash tools/flash/f2838x-uniflash.sh

The script intentionally refuses to guess a probe/board target configuration.
Generate/export the CCXML (and, if needed, .ufsettings) from CCS/UniFlash for
the actual board. The default image is the CI-linked F2838x CPU1 Flash .out.
EOF
}

if [[ -z "${DSLITE}" || -z "${CCXML}" ]]; then
  usage >&2
  echo "ERROR: DSLITE and F2838X_CCXML are required." >&2
  exit 2
fi
for path in "${DSLITE}" "${CCXML}" "${IMAGE}"; do
  if [[ ! -e "${path}" ]]; then
    echo "ERROR: required path does not exist: ${path}" >&2
    exit 2
  fi
done
if [[ -n "${UFSETTINGS}" && ! -e "${UFSETTINGS}" ]]; then
  echo "ERROR: F2838X_UFSETTINGS does not exist: ${UFSETTINGS}" >&2
  exit 2
fi

args=(flash --config="${CCXML}")
if [[ -n "${UFSETTINGS}" ]]; then
  args+=(--load-settings="${UFSETTINGS}")
fi
args+=(-e -f -v "${IMAGE}")

printf 'Flashing verified image with: %q ' "${DSLITE}" "${args[@]}"
printf '\n'
"${DSLITE}" "${args[@]}"
