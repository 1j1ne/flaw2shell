/**
 * 3) 초안 작성 — Claude API 로 8개 고정 섹션 형식의 해설 초안을 쓴다.
 *    모델이 웹 검색·페치로 공식 어드바이저리/패치 커밋을 직접 확인하게 하고,
 *    확인하지 못한 내용은 지어내지 말고 REVIEW_NOTES 에 적게 한다(사람 검토용).
 */
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `당신은 보안 교육 사이트 flaw2shell 의 편집자다. 공개된 CVE 하나를 받아,
결함의 원리와 익스플로잇 흐름을 "개념 중심"으로 해설하는 한국어 초안을 쓴다.
독자는 보안 자격증 준비생, CTF 플레이어, 보안을 공부하는 개발자다. 톤은 담백하고 정확하게, 과장 금지.

## 사실성 (가장 중요)
- 먼저 web_search / web_fetch 로 공식 어드바이저리, NVD, 벤더 공지, 패치 커밋을 확인하라 .
- 출처에서 확인한 사실만 단정적으로 쓴다 그리고 출처를 연결해라. 확인하지 못한 부분은 지어내지 말고 "공개 정보로는 확인되지 않음"이라고 쓰고, REVIEW_NOTES 에 남겨라.
- 함수명·파일명·버전 범위·diff 를 추측으로 만들지 마라. 실제 패치 diff 를 찾지 못했으면 6장은 개념 수준으로 설명하고 그 사실을 밝혀라.

## 책임있는 설계 (반드시 지킬 것)
- 복붙하면 동작하는 익스플로잇, 페이로드, 리버스쉘, 셸코드, 공격 명령어, 무기화된 PoC 를 절대 쓰지 마라.
- 익스플로잇 흐름은 단계의 "개념"만 설명한다. 공격 입력의 구체적인 바이트·문자열도 쓰지 않는다.
- 재현은 인터넷과 분리된 로컬 Docker 랩에서만 해야 한다는 점을 7장에 적는다.
- 뉴스·블로그는 한두 문장 요약과 링크만. 장문 인용 금지.

## 출력 형식 (이 형식 외의 텍스트를 쓰지 마라)
TITLE: <한국어 제목 한 줄, CVE 번호 제외>
DIFFICULTY: <intro | intermediate | advanced>
CWE: <CWE-번호 (NVD 에 있으면 그것을 따른다)>
CWE_LABEL: <영문 CWE 이름, 예: Use-After-Free>
REVIEW_NOTES:
- <검토자가 확인해야 할 점: 불확실한 사실, 출처가 약한 주장, 찾지 못한 정보 등. 없으면 "- 없음">
---BODY---
## 1. TL;DR
## 2. Flaw 분류
## 3. 근본 원인
## 4. 익스플로잇 흐름(개념)
## 5. 트리거 조건
## 6. 패치 분석
## 7. 탐지·완화
## 8. References

본문 규칙:
- 위 8개 H2 제목을 정확히 이 순서로 쓴다. 다른 H2 는 쓰지 않는다 (H3 는 자유).
- 2장은 표(항목 | 값)로 1차 CWE, 공격 벡터, 영향, 전제를 정리한다.
- 4장에는 반드시 아래 형식의 흐름 펜스를 하나 넣는다 (3~6단계, "라벨(보조설명)" 가능, 마지막 단계는 최종 영향):
  \`\`\`flow
  단계1(설명) -> 단계2 -> 단계3 -> 영향
  \`\`\`
- 6장에 실제 패치 diff 를 찾았다면 핵심 부분만 \`\`\`diff-<언어> 펜스(예: diff-c, diff-python)로 인용하고, 그 줄이 왜 흐름을 끊는지 설명한다.
- 7장은 "즉시 조치 / 탐지 / 격리된 실습(로컬 Docker 랩)" 소제목으로 나눈다.
- 8장은 실제로 확인한 공식 출처 링크만 마크다운 목록으로 쓴다.`;

function userPrompt(c) {
  return [
    `다음 CVE 의 해설 초안을 작성하라.`,
    ``,
    `- ID: ${c.id}`,
    `- 공개일: ${c.published}`,
    `- CVSS: ${c.cvss} (${c.severity}) ${c.vector}`,
    `- NVD CWE: ${c.cwes.join(', ') || '(없음 — 원인을 보고 가장 적절한 CWE 하나를 고를 것)'}`,
    `- NVD 설명: ${c.description}`,
    ``,
    `참조 링크 (web_fetch 로 열어 확인 가능):`,
    ...c.references.slice(0, 25).map((r) => `- ${r.url}${r.tags.length ? ` [${r.tags.join(', ')}]` : ''}`),
  ].join('\n');
}

/** 모델 출력 → { title, difficulty, cwe, cweLabel, reviewNotes, body } */
export function parseDraft(text) {
  const start = text.indexOf('TITLE:');
  if (start < 0) throw new Error('출력 형식 오류: TITLE 없음');
  const t = text.slice(start);
  const [head, ...rest] = t.split(/^---BODY---\s*$/m);
  if (!rest.length) throw new Error('출력 형식 오류: ---BODY--- 없음');
  const field = (k) => head.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1].trim() ?? '';
  const notes = head.split(/^REVIEW_NOTES:\s*$/m)[1]?.trim() ?? '';
  const difficulty = field('DIFFICULTY').toLowerCase();
  return {
    title: field('TITLE').replace(/^CVE-\d{4}-\d+\s*[:：-]?\s*/, ''),
    difficulty: ['intro', 'intermediate', 'advanced'].includes(difficulty) ? difficulty : undefined,
    cwe: field('CWE'),
    cweLabel: field('CWE_LABEL'),
    reviewNotes: notes,
    body: rest.join('---BODY---').trim() + '\n',
  };
}

export async function writeDraft(c, { model }) {
  const client = new Anthropic(); // ANTHROPIC_API_KEY 등 환경 자격증명 사용
  const messages = [{ role: 'user', content: userPrompt(c) }];
  let final;
  // 서버 도구(web_search/web_fetch)가 길어지면 pause_turn 으로 끊길 수 있어 이어서 요청한다
  for (let turn = 0; turn < 5; turn++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 64000,
      system: SYSTEM,
      messages,
      output_config: { effort: 'high' },
      // 정책 분류기가 거절하면 서버가 권장 모델로 재시도 (보안 주제라 cyber 분류에 걸릴 수 있음)
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 6 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8 },
      ],
    });
    final = await stream.finalMessage();
    if (final.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: final.content });
  }
  if (final.stop_reason === 'refusal') {
    throw new Error(`모델이 작성을 거절함 (${final.stop_details?.category ?? 'unknown'})`);
  }
  if (final.stop_reason === 'max_tokens') throw new Error('출력이 max_tokens 에서 잘림');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { ...parseDraft(text), model: final.model, usage: final.usage };
}
