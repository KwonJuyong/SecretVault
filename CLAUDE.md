# SecretVault

FastAPI(Python) 백엔드 + Next.js(TypeScript) 프론트엔드 모노레포. Postgres, Caddy 리버스 프록시. Docker Compose 로 구동.

## 구조

- `backend/` — FastAPI. `main.py`, `routers/`, `services/`, `models/`, `schemas/`, `database.py`, `config.py`
- `frontend/` — Next.js App Router. `app/`, `components/`, `contexts/`
- `docker-compose.yml` — caddy / postgres / backend(uvicorn) / frontend
- 루트에 `package.json` 없음. npm 명령은 반드시 `frontend/` 안에서 실행할 것

## 검증

`bash .claude/scripts/verify.sh` — 프론트 `tsc` + `next build` + `eslint`(에러 0) + `vitest`,
백엔드 `ruff` + `mypy` + `pytest`. 전부 통과해야 커밋한다.

`next build` 가 게이트에 있는 이유: tsc·eslint·테스트가 전부 통과해도 빌드가 깨질 수 있다
(예: `useSearchParams` 를 Suspense 없이 쓰면 프리렌더에서만 터진다).

**라이브 E2E** — 실제 클라이언트 암호화로 실제 서버를 때린다. Docker 없이 로컬에서:

```
# 백엔드 (터미널 1)
cd backend && SECRET_KEY=dev-only CORS_ORIGINS=http://localhost:3000 \
  DATABASE_URL=sqlite:///./_devcheck.db .venv/Scripts/python -m uvicorn main:app --port 8000
# 프론트 (터미널 2)
cd frontend && BACKEND_URL=http://127.0.0.1:8000 npx next dev -p 3000
# 테스트 (터미널 3)
cd frontend && LIVE_API=http://127.0.0.1:3000/api npx vitest run lib/*.live.e2e.test.ts
```

`LIVE_API` 가 없으면 자동으로 skip 되므로 일반 `vitest` 실행에는 영향 없다.

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
- **초대 링크**: 워크스페이스 키를 링크 시크릿에서 파생한 키로 래핑. 시크릿은 URL **fragment(`#`)** 에만 존재 →
  브라우저가 서버로 보내지 않는다. 같은 시크릿에서 HKDF 로 `authToken`(서버엔 SHA-256 만) 과 `wrapKey`(브라우저 전용) 를
  **따로** 파생하므로, 서버는 자기가 보관 중인 키를 열 수 없다. (`lib/invite.ts`)
- `decrypt()` 는 실패 시 예외를 던진다. 절대 `''` 를 반환하게 되돌리지 말 것 — 자동저장이 빈 값으로 덮어쓴다
- 읽지 못한 페이지는 `pageLocked` 로 저장을 차단한다

## 동시 편집 (CRDT)

페이지 본문은 Yjs 문서다. 업데이트·스냅샷은 **페이지 키로 암호화한 뒤** WS 로 중계하므로 서버는 읽지도 병합하지도 못한다.

- Yjs 사용 시 ProseMirror history 를 **반드시 끈다**. 안 그러면 Ctrl+Z 가 남의 편집을 되돌린다
- 전체 스냅샷으로 저장해도 안전한 이유는 **CRDT 라서**다. 스냅샷은 이미 본 원격 편집을 모두 병합한 결과
- **복원은 Y.Doc 교체가 아니라 새 편집으로 표현한다.** 교체하면 다른 피어가 영원히 발산한다 (`lib/history.ts`)

## 규칙

- 수정 대상 파일을 반드시 Read 로 전체 읽은 뒤 수정할 것
- 요청한 부분만 수정. 주변 코드 "개선" 금지
- 백엔드 라우터/스키마 시그니처 변경 시 `frontend/` 호출부 전부 확인
- 동일 실패 3회 반복 시 멈추고 사용자에게 보고

## 컨벤션

- **커밋 메시지는 영어로 작성한다** (기존 로그 컨벤션)
- 커밋/푸시는 사용자 확인 후 진행
