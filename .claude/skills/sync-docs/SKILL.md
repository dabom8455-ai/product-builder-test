---
name: sync-docs
description: 회사 운영 매뉴얼 문서(README.md 및 docs/ 하위 .md)를 변경할 때 GitHub와 Notion에 함께 반영한다. 문서를 추가·수정·삭제한 뒤, 또는 사용자가 "문서 동기화 / 노션에도 올려줘 / sync-docs"를 요청할 때 사용. GitHub 커밋·푸시와 Notion 페이지 갱신을 한 번의 절차로 처리하고, 새 문서는 Notion 페이지를 만들어 매핑에 등록한다.
---

# sync-docs — GitHub ↔ Notion 문서 동기화

우리 회사 운영 매뉴얼은 **두 곳에 동일하게** 유지한다.

- **GitHub** (`dabom8455-ai/product-builder-test`, 브랜치 `claude/introduction-4jy6be`) — 원본(source of truth)
- **Notion** (워크스페이스 "이수한의 노션", 부모 페이지 "도현컴퍼니 — 회사 운영 매뉴얼")

이 스킬은 문서를 바꾼 뒤 **양쪽을 한 번에 맞추는 절차**다.
매핑(어느 파일이 어느 Notion 페이지인지)은 같은 폴더의 `notion-map.json`에 있다.

> ⚠️ 방향 규칙: **GitHub(레포 파일)가 원본, Notion은 사본.**
> 항상 레포의 `.md` 내용을 Notion으로 밀어넣는다(→ 단방향). Notion에서 직접 고친 내용은
> 다음 동기화 때 덮어써질 수 있으니, 내용 수정은 되도록 레포 파일에서 한다.

---

## 언제 실행하나
- `README.md` 또는 `docs/**/*.md` 를 추가/수정/삭제한 직후
- 사용자가 "문서 동기화", "노션에도 반영", "/sync-docs" 등을 요청할 때
- 주간 보고 등 새 문서를 만든 뒤

---

## 절차 (매번 이 순서로)

### 0. 사전 확인
1. `notion-map.json`을 읽어 매핑을 파악한다.
2. `git status`로 이번에 바뀐 `.md` 파일 목록을 확인한다.
   (사용자가 특정 문서만 지정했으면 그 문서만 대상으로 한다.)

### 1. GitHub 반영
1. 변경 파일을 `git add`.
2. 명확한 한국어 커밋 메시지로 커밋. 커밋 메시지 끝에 아래를 붙인다:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
3. `git push -u origin claude/introduction-4jy6be` (네트워크 실패 시 2s·4s·8s·16s 백오프로 최대 4회 재시도).
4. **지정 브랜치(`claude/introduction-4jy6be`) 외 다른 브랜치로 푸시하지 않는다.**

### 2. Notion 반영
바뀐 각 `.md` 파일에 대해:

**A) 매핑에 이미 있는 문서 (수정)**
1. `notion-map.json`에서 해당 `repo_file`의 `notion_page_id`를 찾는다.
2. 레포의 `.md` 본문을 읽는다. **맨 위 H1 제목 줄은 제외**하고(제목은 Notion 페이지 속성으로 이미 존재), 나머지 본문을 Notion Markdown으로 준비한다.
3. `notion-update-page`를 호출한다:
   - `page_id`: 매핑된 id
   - `command`: `replace_content`
   - `new_str`: 준비한 본문
   - `allow_deleting_content`: `true` (하위 페이지가 없는 일반 문서이므로 안전)
4. 파일 내부의 상대경로 링크(`[..](../01_...md)`)는 Notion에서 깨지므로, 필요하면 일반 텍스트나 문서 제목 언급으로 바꿔 넣는다.

**B) 매핑에 없는 새 문서 (신규)**
> ⚠️ **팀별로 정리한다.** 모든 페이지를 최상위에 평평하게 쌓지 말고,
> 문서가 속한 팀의 Notion 페이지(아래 `team_pages`) **하위에** 만든다.
1. 문서의 성격/폴더로 소속 팀을 판단해 부모를 고른다 (`notion-map.json`의 `team_pages` 참조):
   - `docs/teams/reports/…마케팅`, `docs/briefs/homepage…`, 마케팅 소재 → **②마케팅팀** 페이지
   - `docs/mvp/…`, `docs/…운영/상담/출결/진도`, 문제파악 인터뷰 → **①학원운영팀** 페이지
   - 재무·가격·수익 → **③수익화팀** · 전자책·콘텐츠 집필 → **④전자책팀**
   - `docs/infra/…`, 데이터·레지스트리 → **⑤인프라** · `docs/strategy/…`, 경쟁·시장 → **⑥전략기획실**
   - 회사 공통(헌장·조직·로드맵·운영지침·플레이북·주간보고 템플릿) → 최상위 **부모 페이지**
   판단이 애매하면 최상위 부모 페이지에 두고 클부장이 나중에 옮긴다.
2. `notion-create-pages`로 그 부모 아래에 새 페이지를 만든다.
   - 제목: 짧은 제목 · 본문: `.md` 본문(H1 제외) · icon: 어울리는 이모지
3. 반환된 새 `notion_page_id`·`url`을 `notion-map.json`의 `documents` 배열에 추가한다.
4. 매핑 파일 변경도 GitHub에 커밋·푸시한다(1단계 절차 재적용).

> 기존 페이지를 다른 팀으로 옮길 땐 `notion-move-pages`를 쓴다(페이지 ID·매핑 유지).

**C) 삭제된 문서**
1. 사용자에게 Notion 페이지도 지울지 확인한다(파괴적 작업).
2. 승인 시 해당 Notion 페이지를 처리하고, 매핑에서 항목을 제거한 뒤 커밋·푸시한다.

### 3. 보고
동기화가 끝나면 클부장 어투로 간단히 보고한다:
- GitHub: 커밋 요약 + 브랜치
- Notion: 갱신/생성된 페이지 제목과 링크
- 남은 이슈(있으면)

---

## 참고
- Notion MCP 도구가 이 세션에 로드돼 있어야 한다. 없으면 `ToolSearch`로
  `mcp__Notion__notion-update-page`, `mcp__Notion__notion-create-pages`,
  `mcp__Notion__notion-fetch`를 불러온다.
- Notion 연결이 끊겨 있으면, GitHub 반영은 먼저 끝내고 Notion 반영은 보류했다가
  연결 복구 후 이어서 처리한다. (양쪽이 어긋난 상태를 사용자에게 반드시 알린다.)
- 큰 문서는 `notion-update-page`가 비동기(async_task)로 처리될 수 있다. 필요하면
  `notion-get-async-task`로 완료를 확인한다.
