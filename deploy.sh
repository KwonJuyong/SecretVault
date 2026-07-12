#!/usr/bin/env bash
#
# SecretVault 배포 스크립트.
#
#   ./deploy.sh                      # pull → 백업 → 캐시정리 → 빌드 → 마이그레이션 → 기동 → 헬스체크
#   ./deploy.sh --no-pull            # 코드가 이미 최신일 때 (CI 등)
#   ./deploy.sh --no-backup          # DB 백업 건너뛰기 (권장하지 않음)
#   ./deploy.sh --keep-cache         # node_modules/.next/빌드캐시 유지 (빠른 재배포)
#   ./deploy.sh --reset-db           # DB 를 완전히 비우고 새로 만든다 (파괴적, 확인 요구)
#   ./deploy.sh --rollback-db FILE   # 백업본으로 DB 복구
#
# 설계 원칙:
#   - 마이그레이션을 앱 기동에 맡기지 않는다. **트래픽을 받기 전에** 별도 컨테이너에서
#     명시적으로 돌리고, 실패하면 앱을 띄우지 않고 멈춘다. 앱이 뜬 뒤 실패하면 이미 늦다.
#   - 마이그레이션 직전에 DB 를 덤프한다. E2E 암호화라 서버에 평문 사본이 없어서,
#     잘못되면 되돌릴 수단이 백업뿐이다.
#   - postgres_data 볼륨은 --reset-db 로 명시하지 않는 한 절대 건드리지 않는다.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# --- 옵션 -------------------------------------------------------------------
DO_PULL=1
DO_BACKUP=1
CLEAN_CACHE=1
RESET_DB=0
ROLLBACK_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --no-pull)     DO_PULL=0 ;;
    --no-backup)   DO_BACKUP=0 ;;
    --keep-cache)  CLEAN_CACHE=0 ;;
    --reset-db)    RESET_DB=1 ;;
    --rollback-db) ROLLBACK_FILE="${2:-}"; shift ;;
    # 상단 주석 블록만 출력하고, 첫 비주석 줄에서 멈춘다.
    -h|--help)
      awk 'NR>1 { if (/^#/) { sub(/^# ?/, ""); print } else { exit } }' "$0"
      exit 0 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
  shift
done

# --- 출력 -------------------------------------------------------------------
if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
else
  B=""; G=""; Y=""; R=""; N=""
fi
step() { echo; echo "${B}==> $*${N}"; }
ok()   { echo "  ${G}OK${N}  $*"; }
warn() { echo "  ${Y}!!${N}  $*"; }
die()  { echo; echo "${R}배포 중단:${N} $*" >&2; exit 1; }

if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  die "docker compose 를 찾을 수 없습니다."
fi

# .env 를 source 하지 않는다. compose 의 env 파일은 셸 문법이 아니라서,
# 값에 공백이나 #, 따옴표가 들어가면 sourcing 이 조용히 어긋나거나 코드를 실행한다.
#
# 반드시 0 으로 끝나야 한다. 키가 없으면 grep 이 1 을 내는데, pipefail + set -e 조합에서는
# 그것만으로 스크립트가 아무 메시지 없이 죽는다. "설정되지 않음" 은 정상적인 상태이므로
# 빈 문자열을 돌려주고 정상 종료한다.
env_get() {
  [ -f .env ] || return 0
  local line=""
  line="$(grep -E "^[[:space:]]*$1=" .env | tail -1)" || return 0
  printf '%s' "$line" | cut -d= -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
  return 0
}

BACKUP_DIR="./backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

wait_for_db() {
  for i in $(seq 1 30); do
    if $DC exec -T db pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# psql 한 줄 질의. env_get 과 같은 이유로 실패해도 0 으로 끝나고 빈 문자열을 돌려준다.
psql_scalar() {
  $DC exec -T db psql -U "$PG_USER" -d "$PG_DB" -tAc "$1" 2>/dev/null | tr -d '[:space:]' || true
  return 0
}

# --- 사전 점검 ----------------------------------------------------------------
step "사전 점검"

[ -f .env ] || die ".env 가 없습니다. .env.example 을 복사해서 채우세요."

SECRET_KEY="$(env_get SECRET_KEY)"
case "$SECRET_KEY" in
  ""|change-me-in-production|secret|changeme)
    die "SECRET_KEY 가 비었거나 placeholder 입니다 — 백엔드가 부팅을 거부합니다.
     생성: python -c \"import secrets; print(secrets.token_urlsafe(48))\"" ;;
esac
ok "SECRET_KEY 설정됨 (${#SECRET_KEY}자)"

PG_USER="$(env_get POSTGRES_USER)"
PG_PASS="$(env_get POSTGRES_PASSWORD)"
PG_DB="$(env_get POSTGRES_DB)"
DB_URL="$(env_get DATABASE_URL)"
for pair in "POSTGRES_USER:$PG_USER" "POSTGRES_PASSWORD:$PG_PASS" "POSTGRES_DB:$PG_DB" "DATABASE_URL:$DB_URL"; do
  [ -n "${pair#*:}" ] || die "${pair%%:*} 가 .env 에 없습니다."
done
ok "DB 환경변수 확인 ($PG_DB)"

CORS="$(env_get CORS_ORIGINS)"
case "$CORS" in
  *'*'*) die "CORS_ORIGINS 에 '*' 는 쓸 수 없습니다 — 자격증명을 보내는 API 라 브라우저가 거부합니다." ;;
  "")    warn "CORS_ORIGINS 미설정 → http://localhost:3000 으로 기본값 사용.
      Caddy 뒤에서는 프론트가 /api 로 same-origin 호출하므로 보통 문제되지 않습니다." ;;
  *)     ok "CORS_ORIGINS = $CORS" ;;
esac

docker info >/dev/null 2>&1 || die "Docker 데몬에 연결할 수 없습니다."
ok "Docker 사용 가능"

# --- 롤백 (지정 시 다른 단계는 건너뛴다) --------------------------------------
if [ -n "$ROLLBACK_FILE" ]; then
  [ -f "$ROLLBACK_FILE" ] || die "백업 파일이 없습니다: $ROLLBACK_FILE"
  step "DB 롤백: $ROLLBACK_FILE"
  echo "  ${R}현재 DB 내용을 이 백업으로 덮어씁니다.${N}"
  confirm=""
  # 비대화형(CI/SSH)에서는 read 가 EOF 로 실패한다. set -e 아래에서 그대로 두면
  # 아무 메시지 없이 죽으므로, 확인을 못 받았다는 사실을 분명히 말하고 멈춘다.
  [ -t 0 ] || die "파괴적인 작업이라 대화형 확인이 필요합니다. 터미널에서 직접 실행하세요."
  read -r -p "  계속하려면 'yes' 입력: " confirm || true
  [ "$confirm" = "yes" ] || die "취소됨."

  $DC up -d db >/dev/null 2>&1
  wait_for_db || die "Postgres 준비 실패."
  $DC exec -T db psql -U "$PG_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$PG_DB\"; CREATE DATABASE \"$PG_DB\" OWNER \"$PG_USER\";" >/dev/null \
    || die "DB 재생성 실패."
  gunzip -c "$ROLLBACK_FILE" | $DC exec -T db psql -U "$PG_USER" -d "$PG_DB" >/dev/null \
    || die "복구 실패."
  ok "복구 완료. 이어서: ./deploy.sh --no-pull --no-backup"
  exit 0
fi

# --- 코드 최신화 --------------------------------------------------------------
if [ "$DO_PULL" -eq 1 ]; then
  step "코드 최신화"
  git rev-parse --git-dir >/dev/null 2>&1 || die "git 저장소가 아닙니다."
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "커밋되지 않은 로컬 변경이 있습니다."
  fi
  BEFORE="$(git rev-parse --short HEAD)"
  git pull --ff-only origin main || die "git pull 실패 (fast-forward 불가). 서버의 로컬 변경을 정리하세요."
  AFTER="$(git rev-parse --short HEAD)"
  [ "$BEFORE" = "$AFTER" ] && ok "이미 최신 ($AFTER)" || ok "$BEFORE → $AFTER"
fi

# --- DB 기동 + 상태 파악 ------------------------------------------------------
step "DB 상태 확인"
$DC up -d db >/dev/null 2>&1 || die "db 컨테이너 기동 실패."
wait_for_db || die "Postgres 가 30초 안에 준비되지 않았습니다."
ok "Postgres 준비됨"

HAS_TABLES="$(psql_scalar "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")"
HAS_ALEMBIC="$(psql_scalar "SELECT to_regclass('public.alembic_version') IS NOT NULL;")"
HAS_TABLES="${HAS_TABLES:-0}"

if [ "$HAS_TABLES" = "0" ]; then
  echo "  빈 DB — 최초 마이그레이션을 수행합니다."
elif [ "$HAS_ALEMBIC" != "t" ]; then
  # 이게 이 배포의 핵심 함정이다. 예전 스키마는 Base.metadata.create_all 로 만들어져
  # alembic_version 이 없다. 그 위에 upgrade head 를 돌리면 초기 마이그레이션이
  # 이미 존재하는 테이블을 만들려다 죽는다.
  if [ "$RESET_DB" -ne 1 ]; then
    die "Alembic 이전에 만들어진 DB 입니다 (테이블 ${HAS_TABLES}개, alembic_version 없음).

  이 스키마는 새 암호화 모델(워크스페이스 키)과 호환되지 않고, 그 위에
  마이그레이션을 얹을 수도 없습니다. 기존 페이지는 어차피 새 구조로 읽히지 않습니다.

  DB 를 비우고 새로 만들려면:
      ./deploy.sh --reset-db

  (백업은 그 전에 자동으로 뜹니다. 되돌리려면 --rollback-db)"
  fi
else
  echo "  Alembic 관리 중인 DB (테이블 ${HAS_TABLES}개)"
fi

# --- 백업 ---------------------------------------------------------------------
BACKUP_PATH=""
if [ "$DO_BACKUP" -eq 1 ] && [ "$HAS_TABLES" != "0" ]; then
  step "DB 백업"
  mkdir -p "$BACKUP_DIR"
  BACKUP_PATH="$BACKUP_DIR/secretvault-$STAMP.sql.gz"

  if $DC exec -T db pg_dump -U "$PG_USER" -d "$PG_DB" 2>/dev/null | gzip > "$BACKUP_PATH" \
     && [ -s "$BACKUP_PATH" ]; then
    ok "$BACKUP_PATH ($(du -h "$BACKUP_PATH" | cut -f1))"
  else
    rm -f "$BACKUP_PATH"; BACKUP_PATH=""
    die "pg_dump 실패. 백업 없이 진행하지 않습니다 (--no-backup 으로 강제 가능)."
  fi

  # 최근 10개만 남긴다. 매칭되는 파일이 없으면 ls 가 실패하는데, pipefail 아래에서는
  # 그것만으로 스크립트가 죽으므로 삼킨다.
  ls -1t "$BACKUP_DIR"/secretvault-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f || true
elif [ "$DO_BACKUP" -ne 1 ]; then
  warn "백업 건너뜀 (--no-backup)"
fi

# --- DB 초기화 (명시적 요청 시) -----------------------------------------------
if [ "$RESET_DB" -eq 1 ]; then
  step "DB 초기화"
  echo "  ${R}'$PG_DB' 의 모든 데이터를 삭제합니다.${N}"
  [ -n "$BACKUP_PATH" ] && echo "  백업: $BACKUP_PATH"
  confirm=""
  [ -t 0 ] || die "파괴적인 작업이라 대화형 확인이 필요합니다. 터미널에서 직접 실행하세요."
  read -r -p "  계속하려면 'reset' 입력: " confirm || true
  [ "$confirm" = "reset" ] || die "취소됨."

  $DC stop backend frontend >/dev/null 2>&1 || true
  $DC exec -T db psql -U "$PG_USER" -d postgres -c \
    "DROP DATABASE IF EXISTS \"$PG_DB\" WITH (FORCE); CREATE DATABASE \"$PG_DB\" OWNER \"$PG_USER\";" >/dev/null \
    || die "DB 재생성 실패."
  ok "DB 비움"
fi

# --- 캐시 정리 ----------------------------------------------------------------
if [ "$CLEAN_CACHE" -eq 1 ]; then
  step "캐시 정리"
  $DC stop frontend backend >/dev/null 2>&1 || true

  # node_modules 는 named volume 이라 재빌드해도 살아남는다. 의존성이 바뀐 뒤 옛 버전이
  # 남아 있으면 이미지와 어긋난다. 프로젝트 접두사는 compose 버전마다 다르므로 이름으로 찾는다.
  for vol in $(docker volume ls -q | grep -E 'frontend_node_modules$' || true); do
    docker volume rm "$vol" >/dev/null 2>&1 && ok "볼륨 제거: $vol" || true
  done

  rm -rf frontend/.next frontend/tsconfig.tsbuildinfo 2>/dev/null || true
  ok "frontend/.next 제거"
  # postgres_data / caddy_data 는 건드리지 않는다. docker volume prune 도 쓰지 않는다.
else
  warn "캐시 유지 (--keep-cache)"
fi

# --- 빌드 ---------------------------------------------------------------------
step "이미지 빌드"
$DC build --pull backend frontend || die "이미지 빌드 실패."
ok "빌드 완료"

# --- 마이그레이션 --------------------------------------------------------------
step "DB 마이그레이션 (Alembic)"
$DC up -d db >/dev/null 2>&1
wait_for_db || die "Postgres 준비 실패."

BEFORE_REV="$($DC run --rm --no-deps -T backend alembic current 2>/dev/null | tail -1 || true)"
echo "  현재: ${BEFORE_REV:-(없음 — 최초)}"

if ! $DC run --rm --no-deps -T backend alembic upgrade head; then
  echo
  echo "${R}마이그레이션 실패. 앱을 기동하지 않았습니다.${N}" >&2
  [ -n "$BACKUP_PATH" ] && echo "  되돌리기: ./deploy.sh --rollback-db $BACKUP_PATH" >&2
  exit 1
fi

AFTER_REV="$($DC run --rm --no-deps -T backend alembic current 2>/dev/null | tail -1 || true)"
ok "리비전: ${AFTER_REV:-head}"

# --- 기동 ---------------------------------------------------------------------
step "서비스 기동"
$DC up -d --force-recreate --remove-orphans || die "서비스 기동 실패."
ok "컨테이너 기동됨"

# --- 헬스체크 ------------------------------------------------------------------
step "헬스체크"
HEALTHY=0
for i in $(seq 1 60); do
  if curl -fsS -m 3 http://127.0.0.1:8001/health >/dev/null 2>&1; then HEALTHY=1; break; fi
  sleep 2
done
if [ "$HEALTHY" -ne 1 ]; then
  echo
  echo "${R}백엔드가 120초 안에 응답하지 않았습니다.${N}" >&2
  $DC logs --tail=40 backend >&2 || true
  exit 1
fi
ok "백엔드 정상 (127.0.0.1:8001/health)"

# 프론트는 첫 기동에서 npm install 을 하므로 더 걸린다.
for i in $(seq 1 90); do
  if curl -fsS -m 3 -o /dev/null http://127.0.0.1:3001/login 2>/dev/null; then
    ok "프론트엔드 정상 (127.0.0.1:3001)"; break
  fi
  if [ "$i" -eq 90 ]; then
    warn "프론트엔드가 아직 응답하지 않습니다 — 첫 배포는 npm install 때문에 오래 걸립니다."
    warn "확인: $DC logs -f frontend"
  fi
  sleep 2
done

# --- 도커 정리 -----------------------------------------------------------------
step "도커 정리"
docker image prune -f >/dev/null 2>&1 && ok "미사용 이미지 제거" || true
docker builder prune -f >/dev/null 2>&1 && ok "빌드 캐시 제거" || true

echo
echo "${G}${B}배포 완료${N}  ($(git rev-parse --short HEAD 2>/dev/null || echo '?'))"
[ -n "$BACKUP_PATH" ] && echo "  백업: $BACKUP_PATH"
echo "  상태: $DC ps"
echo "  로그: $DC logs -f backend"
