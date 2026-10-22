# flaw2shell

> 패치 한 줄이 왜 RCE를 막는가 — 공개 CVE를 **원리 중심**으로 해설하는 보안 교육용 정적 사이트.

exploit-db식 무기 저장소가 아니라, 결함(flaw)이 어떻게 코드 실행(shell)까지 이어지는지와 **패치가 그 흐름을 어디서 끊는지**를 설명합니다. 무기화된 PoC는 싣지 않습니다.

- 스택: **Astro 5 (static output)** — 선택 이유는 `astro.config.mjs` 상단 주석 참고
- 콘텐츠: 외부 CVE 수집 파이프라인이 커밋하는 `content/posts/*.md`
- 런타임 외부 호출 없음 (폰트 self-host, 검색 인덱스는 정적 JSON, 다이어그램은 빌드타임 인라인 SVG)

---

## 빠른 시작

```bash
npm ci            # Node 22 (.nvmrc)
npm run dev       # http://localhost:4321
npm run build     # astro build + scripts/verify-build.mjs (게이트 검증)
npm run preview   # dist/ 미리보기
npm run clean     # dist/ 와 콘텐츠 캐시 삭제 (플러그인 수정 후 필요)
```

> remark/rehype 플러그인(`src/plugins/*`)을 고친 뒤에는 `npm run clean` 을 먼저 하세요. Astro 콘텐츠 레이어가 렌더 결과를 캐시합니다.

---

## 폴더 구조

```
content/
  posts/                 ← 파이프라인 출력 (*.md, 최상위만 로드)
    CVE-2026-6722.md       샘플 (8섹션 + flow + diff)
    en/CVE-2026-6722.md    선택: 영문 번역 (같은 id)
  drafts/                ← 빌드에서 완전히 무시 (검토 대기)
src/
  content.config.ts      ← §3 프런트매터 스키마 (Zod) + published 게이트
  data/cwe.ts            ← CWE 카탈로그 (클래스 페이지·퀴즈·난이도 추정)
  lib/
    posts.ts             ← 유일한 포스트 접근 계층 (status 게이트, 요약/검색 텍스트)
    sections.mjs         ← 8개 고정 섹션 정의
    quiz.ts              ← 퀴즈/플래시카드 생성
    i18n.ts              ← UI 문자열 (ko/en)
  plugins/
    remark-safety.mjs    ← 무기화 코드 렌더 차단
    safety-patterns.mjs  ← 차단 패턴 목록 (빌드·검증 공용)
    remark-flow.mjs      ← ```flow → 단계 다이어그램 SVG
    remark-diff.mjs      ← ```diff / ```diff-<lang> → added/removed 하이라이트
    rehype-sections.mjs  ← 섹션 안정 앵커(#tldr … #references) + <section> 래핑
    rehype-external-links.mjs ← 외부 링크 새 탭 + 헤딩 앵커
  components/ layouts/ pages/ styles/
scripts/verify-build.mjs ← 빌드 후 산출물 검증 (실패 시 exit 1 → 배포 중단)
```

## 라우트

| 경로 | 내용 |
| --- | --- |
| `/` | 최신 피드 (심각도·CWE·난이도·날짜) + 클라이언트 검색 + 난이도/심각도 필터 (`?q=&d=&s=` URL 동기화, `/` 키로 검색 포커스) |
| `/cve/[id]` | 상세: 8섹션, 목차(TOC)·앵커, flow 다이어그램, 패치 diff, 고지, 공식 참조 |
| `/class/[cwe]` | CWE별 모음 + 근본 원인/전형적 패치 패턴 요약 |
| `/classes` | 전체 클래스 인덱스 (계열별) |
| `/quiz` | 객관식 + 플래시카드 (`?post=<id>`, `?cwe=<CWE>` 프리셋, 틀린 문제 반복) |
| `/ai-security` | LLM/ML 트랙 (track: ai, AI 계열 CWE, ai/llm/ml 태그) + 개념 프라이머 |
| `/about` | 사이트 목적 + 책임있는 공개 원칙 |
| `/search.json` | 검색 인덱스 (published 만) |

---

## 새 포스트 추가

### 1) 프런트매터 (파이프라인 스키마 — 변경 금지)

```yaml
---
id: CVE-2026-6722          # 고유 식별자 = 라우트 키 (/cve/CVE-2026-6722/)
cvss: 9.8                  # number 0–10
severity: CRITICAL         # CRITICAL | HIGH | MEDIUM | LOW
cwe: CWE-416               # 1차 CWE (CWE-<번호>)
cwe_label: Use-After-Free  # 사람이 읽는 라벨
status: published          # published 만 렌더. needs_review / draft 는 제외
difficulty: advanced       # intro | intermediate | advanced (없으면 CWE로 추정, 뱃지에 * 표시)
generated_by: pipeline     # 있으면 "파이프라인 생성 · 사람 검토 후 게시" 배지
---
```

`status: published` 문서는 위 필드를 **엄격 검증**합니다(형식이 틀리면 빌드 실패). 비공개 문서는 필드가 덜 채워져 있어도 빌드를 깨지 않지만 어디에도 렌더되지 않습니다.

선택 확장 필드 (없어도 됨):

| 필드 | 없을 때 |
| --- | --- |
| `title` | `"<id>: <cwe_label>"` |
| `date` | 파일 수정 시각 → **파이프라인에서 넣는 것을 권장** (CI 체크아웃 시각이 되므로) |
| `summary` | TL;DR 섹션 첫 문장들 |
| `tags`, `track: ai` | AI 트랙 분류에 사용 |
| `quiz: [{q, choices, answer, explain}]` | 메타데이터 기반 자동 문제만 생성 |
| `sample: true` | 시연용 배너 표시 |

### 2) 본문 — 8개 고정 H2 섹션 (이 순서)

```markdown
## 1. TL;DR
## 2. Flaw 분류
## 3. 근본 원인
## 4. 익스플로잇 흐름(개념)
## 5. 트리거 조건
## 6. 패치 분석
## 7. 탐지·완화
## 8. References
```

번호(`4.`)가 있으면 번호로, 없으면 키워드로 섹션을 인식해 언어와 무관한 앵커(`#tldr`, `#classification`, `#root-cause`, `#exploit-flow`, `#trigger`, `#patch`, `#detection`, `#references`)를 붙입니다. 빠진 섹션은 빌드 경고와 함께 목차에 취소선으로 표시됩니다.

**흐름 다이어그램** — `->` 로 단계를 잇고, `라벨(보조설명)` 형식을 쓸 수 있습니다. 마지막 단계는 영향(impact)으로 강조됩니다. 명령어처럼 보이는 단계는 `[명령 생략]` 으로 대체됩니다.

````markdown
```flow
트리거(중복키로 해제) -> 힙 재점유(문자열 할당) -> dangling 포인터 역참조 -> RCE
```
````

**패치 diff** — 통합 diff를 그대로 붙입니다. `diff-<언어>` 로 쓰면 +/- 를 뗀 코드에 구문 강조가 적용됩니다.

````markdown
```diff-c
@@ static int decode_pair(...)
-        value_release(old);
+        decode_ctx_defer_release(ctx, old);
```
````

### 3) 영문 번역 (선택)

`content/posts/en/<id>.md` 에 같은 `id` 로 작성합니다 (`title`, `summary`, `quiz` 번역 가능; quiz 의 `answer` 는 원문 것을 사용). 번역이 없으면 EN 모드에서 안내 문구와 함께 한국어 원문을 보여 줍니다.

### 4) 게시 흐름

```
파이프라인 → content/drafts/ 또는 content/posts/ (status: needs_review)
         → 사람 검토 → status: published 로 변경 + content/posts/ 로 이동 → 커밋
         → CI: build + verify → 배포
```

---

## 책임있는 설계 (§7) — 어떻게 강제되는가

| 원칙 | 구현 |
| --- | --- |
| 무기화 코드 금지 | `remark-safety` 가 리버스쉘·인코딩된 PowerShell·페이로드 생성기·셸코드 바이트열·`curl … \| sh` 등의 패턴이 있는 블록을 **렌더 차단**. 검색 인덱스·요약·퀴즈 텍스트에서도 해당 줄 제거. `F2S_STRICT_SAFETY=1` (CI 기본값)이면 원본에 패턴이 있을 때 **배포 실패** |
| 사람 검토 게이트 | 빌드: `getPublishedPosts()` 만 라우트/검색/퀴즈 생성 · 렌더: 상세 페이지가 비공개 문서면 throw · 산출물: `verify-build.mjs` 가 비공개 id 가 `dist/` 어디에도 없는지 검사 |
| 방어·교육 고지 | 모든 상세 페이지 상단 고지 (verify 가 존재 확인) + 푸터 + `/about` |
| 격리 실습 전제 | 고지문·`/about`·샘플 7장 "격리된 실습(로컬 Docker 랩)" |
| 공식 패치로 연결 | CVE id 면 NVD/CVE.org 링크 자동 생성, References 외부 링크는 새 탭(`noopener noreferrer`) |
| 저작권 | 뉴스는 요약+링크만 (푸터·`/about` 명시) |

패턴 목록은 `src/plugins/safety-patterns.mjs` 에서 관리합니다. 오탐이 있으면 패턴을 좁히고, 미탐이 있으면 추가하세요.

---

## 배포

### GitHub Pages (`.github/workflows/deploy.yml`)
1. 저장소 Settings → Pages → Source: **GitHub Actions**
2. `main` push, 수동 실행, 또는 파이프라인의 `repository_dispatch` 로 재빌드:
   ```bash
   gh api repos/<owner>/<repo>/dispatches -f event_type=content-updated
   ```
3. PR 에서는 빌드·검증만 실행 → 파이프라인이 PR 로 올리면 CI 통과 + 사람 리뷰 후 머지.
4. 하위 경로(`/<repo>/`)는 `BASE_PATH` 로 처리됩니다. 커스텀 도메인이면 워크플로의 `SITE_URL`/`BASE_PATH` 를 수정하세요.

### Netlify / Vercel
저장소를 연결하면 `netlify.toml` / `vercel.json` 설정으로 커밋마다 재빌드됩니다 (보안 헤더·CSP 포함).

### 환경 변수
| 이름 | 기본값 | 설명 |
| --- | --- | --- |
| `SITE_URL` | `https://flaw2shell.example` | canonical URL |
| `BASE_PATH` | `/` | 하위 경로 배포 시 |
| `F2S_STRICT_SAFETY` | (없음) | `1` 이면 원본의 무기화 패턴을 배포 실패로 처리 |

---

## 확인된 사항

- 라이트/다크 × 데스크톱(1366px)/모바일(390px) 전 페이지에서 가로 스크롤 없음, JS 오류 없음 (Playwright로 검증)
- flow 다이어그램: 데스크톱 가로 / 모바일 세로 자동 전환, 스크린리더용 `<ol>` 병기
- 심각도: 색 + 라벨 텍스트 + 막대 개수(4/3/2/1)로 구분 — 색만으로 구분하지 않음
- 다크 기본, 테마·언어 선택은 `localStorage` 에 저장 (페인트 전 적용, 깜빡임 없음)

## 샘플 콘텐츠에 대한 주의

`CVE-2026-6722` 는 실제 CVE ID 입니다. 하지만 샘플 본문의 기술 세부(코드·diff·흐름)는 **렌더링 시연용 예시**이며, 페이지에 `SAMPLE` 배너로 표시됩니다. 실제 게시 전에는 공식 어드바이저리 기준으로 다시 작성하고 `sample: true` 를 제거하세요. `content/posts/CVE-0000-00001-needs-review.md` 와 `content/drafts/` 는 게이트 시연용입니다.
