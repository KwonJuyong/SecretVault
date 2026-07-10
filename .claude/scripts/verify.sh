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
echo "=== backend: 파이썬 문법 검사 ==="
# Windows Store 스텁은 어떤 인자를 줘도 exit 0 이므로, 실제로 코드를 실행하는지 먼저 확인한다.
real_python=""
for c in python python3; do
  command -v "$c" >/dev/null 2>&1 || continue
  [ "$("$c" -c 'print("PYOK")' 2>/dev/null)" = "PYOK" ] && { real_python="$c"; break; }
done

if [ -n "$real_python" ]; then
  if out=$("$real_python" -m compileall -q "$ROOT/backend" 2>&1); then
    echo "PASS  ($real_python)"
  else
    echo "FAIL"; echo "$out" | head -30; fail=1
  fi
elif command -v docker >/dev/null 2>&1; then
  if out=$(cd "$ROOT" && docker compose exec -T backend python -m compileall -q . 2>&1); then
    echo "PASS  (docker compose exec backend)"
  else
    echo "FAIL  (컨테이너가 떠 있지 않으면 'docker compose up -d backend' 후 재시도)"
    echo "$out" | head -20; fail=1
  fi
else
  echo "SKIP  실행 가능한 python 도, docker 도 없음 — 백엔드는 검증되지 않았음"
  echo "      (host python 은 WindowsApps 스텁일 수 있음: 항상 exit 0)"
fi

echo
[ "$fail" -eq 0 ] && echo "RESULT: 실행된 검사는 모두 통과 (SKIP 항목은 검증 안 됨)" \
                  || echo "RESULT: 실패한 검사 있음 — 커밋 중단"
exit "$fail"
