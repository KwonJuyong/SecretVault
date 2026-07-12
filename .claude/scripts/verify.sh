#!/usr/bin/env bash
# 프론트/백엔드를 각각 검증한다.
# 원칙: 실행하지 못한 검사를 통과로 보고하지 않는다. 못 하면 SKIP 으로 명시한다.
# 호스트에 python 이 없을 수 있고(Windows Store 스텁 포함), docker 도 없을 수 있다.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fail=0

echo "=== frontend: tsc --noEmit ==="
if [ -f "$ROOT/frontend/tsconfig.json" ]; then
  if out=$(cd "$ROOT/frontend" && npx --no-install tsc --noEmit 2>&1); then
    echo "PASS"
  else
    echo "FAIL"; echo "$out" | head -30; fail=1
  fi
else
  echo "SKIP  tsconfig.json 없음"
fi

echo
echo "=== frontend: vitest ==="
if [ -f "$ROOT/frontend/vitest.config.ts" ]; then
  if out=$(cd "$ROOT/frontend" && npx --no-install vitest run 2>&1); then
    echo "PASS  ($(echo "$out" | grep -Eo '[0-9]+ passed' | tail -1))"
  else
    echo "FAIL"; echo "$out" | tail -30; fail=1
  fi
else
  echo "SKIP  vitest.config.ts 없음"
fi

# 백엔드는 .venv 를 우선 쓴다. 없으면 만들 수 있는 python 을 찾는다.
# 주의: PATH 의 python 이 Windows Store 스텁일 수 있다 — 스텁은 어떤 인자를 줘도 exit 0 이므로
# 반드시 실제로 코드를 실행시켜서(PYOK) 진짜 인터프리터인지 확인한다.
BE_PY="$ROOT/backend/.venv/Scripts/python.exe"
[ -x "$BE_PY" ] || BE_PY="$ROOT/backend/.venv/bin/python"
if [ ! -x "$BE_PY" ] || [ "$("$BE_PY" -c 'print("PYOK")' 2>/dev/null)" != "PYOK" ]; then
  BE_PY=""
fi

run_backend() {  # run_backend <label> <args...>
  local label="$1"; shift
  echo "=== backend: $label ==="
  if [ -z "$BE_PY" ]; then
    echo "SKIP  backend/.venv 없음 — 검증되지 않았음"
    echo "      만들기: python -m venv backend/.venv && backend/.venv/Scripts/python -m pip install -r backend/requirements-dev.txt"
    return
  fi
  if out=$(cd "$ROOT/backend" && "$BE_PY" -m "$@" 2>&1); then
    echo "PASS"
  else
    echo "FAIL"; echo "$out" | tail -25; fail=1
  fi
}

echo
run_backend "ruff"   ruff check .
echo
run_backend "mypy"   mypy .
echo
run_backend "pytest" pytest tests/ -q --no-header -p no:cacheprovider

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: 실행된 검사는 모두 통과 (SKIP 항목은 검증 안 됨)"
else
  echo "RESULT: 실패한 검사 있음 — 커밋 중단"
fi
exit "$fail"
