#!/usr/bin/env bash
set -euo pipefail
mkdir -p build/host
gcc -std=c11 -Wall -Wextra -Werror \
  19_c2000_buck_firmware_lab/firmware/buck_control.c \
  19_c2000_buck_firmware_lab/firmware/host_sil.c \
  -I19_c2000_buck_firmware_lab/firmware -lm -o build/host/c2000-buck-sil
build/host/c2000-buck-sil
