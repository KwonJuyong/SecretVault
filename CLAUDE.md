# SecretVault

FastAPI(Python) 백엔드 + Next.js(TypeScript) 프론트엔드 모노레포. Postgres, Caddy 리버스 프록시. Docker Compose 로 구동.

## 구조

- `backend/` — FastAPI. `main.py`, `routers/`, `services/`, `models/`, `schemas/`, `database.py`, `config.py`
- `frontend/` — Next.js App Router. `app/`, `components/`, `contexts/`
- `docker-compose.yml` — caddy / postgres / backend(uvicorn) / frontend
- 루트에 `package.json` 없음. npm 명령은 반드시 `frontend/` 안에서 실행할 것

## 검증

`bash .claude/scripts/verify.sh` — 프론트 `tsc --noEmit` + `vitest`, 백엔드 `ruff` + `mypy` + `pytest`.
전부 통과해야 커밋한다.

백엔드는 `backend/.venv` 를 사용한다. 없으면 만든다:

```
python -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -r backend/requirements-dev.txt
```

주의: 호스트 PATH 의 `python` 이 WindowsApps 스텁일 수 있다 — 스텁은 **무엇을 실행하든 exit 0** 을 낸다.
`verify.sh` 는 실제로 코드를 실행시켜(`PYOK`) 진짜 인터프리터인지 확인하고, 없으면 `SKIP` 으로 보고한다.
**`SKIP` 은 통과가 아니다.** (실제 Python 은 `%LOCALAPPDATA%\Programs\Python\Python312` 에 설치되어 있다.)

테스트는 인메모리 SQLite 로 돈다. 모델은 Postgres 전용 타입 대신 범용 `sqlalchemy.Uuid` 를 쓰므로
양쪽에서 같은 스키마가 만들어진다.

## 마이그레이션

스키마 변경은 **반드시 Alembic** 으로 한다. `Base.metadata.create_all` 은 기존 테이블을 변경하지 못한다.

```
cd backend
.venv/Scripts/python -m alembic revision --autogenerate -m "설명"
.venv/Scripts/python -m alembic upgrade head
```

앱 기동 시 `main.py` 가 자동으로 `upgrade head` 를 수행한다(SQLite 는 제외).

## 암호화 (중요)

E2E 라 서버에 평문이 없다. **키 관련 버그는 곧 영구 데이터 손실이다.**

- 워크스페이스마다 AES-KW 키 1개. 멤버의 RSA 공개키로 래핑해 `workspace_key_grants` 에 보관 → 초대는 O(1)
- 페이지 AES-GCM 키는 워크스페이스 키로 래핑해 `pages.encrypted_page_key` 에 보관 → 모든 멤버가 읽음
- `page_key_grants` 는 **워크스페이스 외부** 사용자에게 개별 페이지를 공유할 때만 쓴다 (RSA 직접 래핑)
- `decrypt()` 는 실패 시 예외를 던진다. 절대 `''` 를 반환하게 되돌리지 말 것 — 자동저장이 빈 값으로 덮어쓴다
- 읽지 못한 페이지는 `pageLocked` 로 저장을 차단한다

## 규칙

- 수정 대상 파일을 반드시 Read 로 전체 읽은 뒤 수정할 것
- 요청한 부분만 수정. 주변 코드 "개선" 금지
- 백엔드 라우터/스키마 시그니처 변경 시 `frontend/` 호출부 전부 확인
- 동일 실패 3회 반복 시 멈추고 사용자에게 보고

## 컨벤션

- **커밋 메시지는 영어로 작성한다** (기존 로그 컨벤션)
- 커밋/푸시는 사용자 확인 후 진행
