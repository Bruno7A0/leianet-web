#!/bin/sh
# Compila assets/seedmap.wasm. Requiere wasi-sdk (probado con v25) y cubiomes (commit e61f905).
# Uso: WASI=/ruta/wasi-sdk CUB=/ruta/cubiomes ./build.sh  (desde tools/seedmap)
set -e
: "${WASI:=/opt/wasi-sdk}"; : "${CUB:=./cubiomes}"
SRC="$CUB/noise.c $CUB/biomes.c $CUB/layers.c $CUB/biomenoise.c $CUB/generator.c $CUB/finders.c $CUB/util.c"
"$WASI/bin/clang" --target=wasm32-wasi --sysroot="$WASI/share/wasi-sysroot" -O2 -fwrapv -I"$CUB" \
  -mexec-model=reactor -Wl,--no-entry -Wl,-z,stack-size=1048576 -Wl,--initial-memory=16777216 \
  -Wl,--max-memory=268435456 -Wl,--strip-all -o ../../assets/seedmap.wasm seedmap.c $SRC -lm
