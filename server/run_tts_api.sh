#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8003}"
F5_TTS_ROOT="${F5_TTS_ROOT:-/workspace/personal/team_folders/vansh.pundir/F5-TTS-22-lang/F5-TTS}"

if [[ -z "${CUDA_VISIBLE_DEVICES:-}" ]]; then
  if command -v nvidia-smi >/dev/null 2>&1; then
    BEST_GPU="$(nvidia-smi --query-gpu=index,memory.free --format=csv,noheader,nounits       | awk -F, 'BEGIN { best=-1; gpu=0 } { g=$1; free=$2; gsub(/ /, "", g); gsub(/ /, "", free); if (free > best) { best=free; gpu=g } } END { print gpu }')"
    export CUDA_VISIBLE_DEVICES="${BEST_GPU:-0}"
  else
    export CUDA_VISIBLE_DEVICES="0"
  fi
fi

export ESPEAK_MODE="${ESPEAK_MODE:-custom}"
export F5_TTS_LAZY_LOAD="${F5_TTS_LAZY_LOAD:-1}"
export F5_TTS_ROOT
export PYTHONPATH="${F5_TTS_ROOT}/src:${PYTHONPATH:-}"

cd "$(dirname "$0")"
echo "Starting F5-TTS API on ${HOST}:${PORT} with CUDA_VISIBLE_DEVICES=${CUDA_VISIBLE_DEVICES}"
exec uvicorn tts_api:app --host "${HOST}" --port "${PORT}"
