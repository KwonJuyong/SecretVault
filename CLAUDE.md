# SecretVault

FastAPI(Python) 백엔드 + Next.js(TypeScript) 프론트엔드 모노레포. Postgres, Caddy 리버스 프록시. Docker Compose 로 구동.

## 구조

- `backend/` — FastAPI. `main.py`, `routers/`, `services/`, `models/`, `schemas/`, `database.py`, `config.py`
- `frontend/` — Next.js App Router. `app/`, `components/`, `contexts/`
- `docker-compose.yml` — caddy / postgres / backend(uvicorn) / frontend
- 루트에 `package.json` 없음. npm 명령은 반드시 `frontend/` 안에서 실행할 것

## 검증

`bash .claude/scripts/verify.sh` — 프론트 `tsc --noEmit` + 백엔드 문법 검사.

주의: 호스트 `python` 이 WindowsApps 스텁이면 **무엇을 실행하든 exit 0** 을 낸다.
스크립트는 이를 감지해 `SKIP` 으로 보고한다. **`SKIP` 은 통과가 아니다.**
백엔드를 실제로 검증하려면 Docker 가 필요하다: `docker compose up -d backend`.

백엔드에는 lint/type 도구(ruff, mypy)가 설치되어 있지 않다. 문법 검사가 전부다.

## 규칙

- 수정 대상 파일을 반드시 Read 로 전체 읽은 뒤 수정할 것
- 요청한 부분만 수정. 주변 코드 "개선" 금지
- 백엔드 라우터/스키마 시그니처 변경 시 `frontend/` 호출부 전부 확인
- 동일 실패 3회 반복 시 멈추고 사용자에게 보고

## 컨벤션

- **커밋 메시지는 영어로 작성한다** (기존 로그 컨벤션)
- 커밋/푸시는 사용자 확인 후 진행
