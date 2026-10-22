/** §3 본문 8개 고정 섹션 정의 — 순서 = 렌더 순서. 플러그인/페이지/검증 스크립트가 공유한다. */
export const SECTIONS = [
  { n: 1, key: 'tldr', ko: 'TL;DR', en: 'TL;DR', match: /tl;?dr|요약|summary/i },
  { n: 2, key: 'classification', ko: 'Flaw 분류', en: 'Flaw classification', match: /분류|classif/i },
  { n: 3, key: 'root-cause', ko: '근본 원인', en: 'Root cause', match: /근본|원인|root/i },
  { n: 4, key: 'exploit-flow', ko: '익스플로잇 흐름(개념)', en: 'Exploit flow (conceptual)', match: /익스플로잇|흐름|exploit/i },
  { n: 5, key: 'trigger', ko: '트리거 조건', en: 'Trigger conditions', match: /트리거|trigger|조건/i },
  { n: 6, key: 'patch', ko: '패치 분석', en: 'Patch analysis', match: /패치|patch|fix/i },
  { n: 7, key: 'detection', ko: '탐지·완화', en: 'Detection & mitigation', match: /탐지|완화|detect|mitigat/i },
  { n: 8, key: 'references', ko: 'References', en: 'References', match: /refer|참고|출처/i },
];

/** H2 텍스트 → 섹션 정의. "4. 익스플로잇 흐름" 처럼 번호가 있으면 번호 우선. */
export function matchSection(text) {
  const t = String(text).trim();
  const num = t.match(/^(\d)\s*[.)]/);
  if (num) {
    const s = SECTIONS.find((x) => x.n === Number(num[1]));
    if (s) return s;
  }
  return SECTIONS.find((s) => s.match.test(t)) || null;
}
