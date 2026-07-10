---
name: pre-commit
description: 커밋 전 변경사항 검증 (프론트 타입체크 + 백엔드 문법검사 + 영향 분석)
context: fork
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(bash .claude/scripts/verify.sh) Read Grep Glob
disallowed-tools: Write Edit
---

## 1. 변경 확인

!`git status --short`

!`git diff --stat`

## 2. 검증 실행

!`bash .claude/scripts/verify.sh`

판정 기준:

- `FAIL` 이 하나라도 있으면 커밋 중단하고 원인과 수정 방법을 보고한다.
- `SKIP` 은 통과가 아니다. 그 영역은 검증되지 않았다는 뜻이므로 보고에 반드시 명시한다.
  호스트 `python` 은 WindowsApps 스텁일 수 있어 무엇을 주든 exit 0 을 낸다. 이걸 통과로 읽지 말 것.

## 3. 영향 분석

변경된 각 파일에 대해:

- `backend/` — 라우터·스키마 시그니처가 바뀌었으면 이를 호출하는 `frontend/` 코드를 Grep 으로 확인
- `frontend/` — export 된 컴포넌트/훅의 시그니처 변경 시 사용처 Grep
- 삭제된 코드가 다른 곳에서 참조 중인지 확인

## 4. 판정

- 통과: 커밋 가능. 커밋 메시지 제안 — **이 저장소는 영어 커밋 메시지를 쓴다** (기존 로그 참고).
- 실패: 문제점과 수정 방법.
- 어느 쪽이든 `SKIP` 된 검사가 있으면 마지막에 다시 언급한다.
