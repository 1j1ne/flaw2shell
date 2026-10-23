/**
 * 3) 초안 작성 — Claude API 로 8개 고정 섹션 형식의 해설 초안을 쓴다.
 *    메인은 영어로 작성(모델이 web_search/web_fetch 로 공식 어드바이저리·패치를 직접 확인),
 *    그 뒤 한국어로 번역(서브). 확인하지 못한 내용은 지어내지 말고 REVIEW_NOTES 에 남긴다.
 *
 *    writeDraft()      → 영어 초안 { title, difficulty, cwe, cweLabel, reviewNotes, body }
 *    translateToKorean() → 한국어 번역 { title, body } (구조·코드·링크 보존)
 */
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `You are the editor of flaw2shell, a security-education site. Given one public CVE,
you write an English draft that explains the flaw's mechanism and exploit flow in a concept-first way.
Readers are security-cert students, CTF players, and developers studying security. Tone: plain and precise, no hype.

## Factuality (most important)
- First use web_search / web_fetch to confirm the official advisory, NVD, vendor notices, and the patch commit.
- State as fact only what you confirmed in sources, and link those sources. For anything you could not confirm,
  do not invent it — write "not confirmed in public sources" and note it under REVIEW_NOTES.
- Do not guess function names, file names, version ranges, or diffs. If you cannot find the real patch diff,
  explain section 6 at a conceptual level and say so.

## Responsible design (must follow)
- Never write copy-paste-runnable exploits, payloads, reverse shells, shellcode, attack commands, or weaponized PoCs.
- Describe the exploit flow only as the "concept" of each step. Do not write concrete bytes/strings of attack input.
- State in section 7 that reproduction must happen only in a local Docker lab isolated from the internet.
- For news/blogs, give a one- or two-sentence summary and a link only. No long quotes.

## Output format (write no text outside this format)
TITLE: <one-line English title, excluding the CVE number>
DIFFICULTY: <intro | intermediate | advanced>
CWE: <CWE-number (follow NVD if present)>
CWE_LABEL: <English CWE name, e.g. Use-After-Free>
REVIEW_NOTES:
- <points for the reviewer: uncertain facts, weakly sourced claims, info you could not find. "- none" if none>
---BODY---
## 1. TL;DR
## 2. Flaw classification
## 3. Root cause
## 4. Exploit flow (conceptual)
## 5. Trigger conditions
## 6. Patch analysis
## 7. Detection & mitigation
## 8. References

Body rules:
- Use exactly these 8 H2 headings in this order. Do not use any other H2 (H3 is free).
- Section 2 is a table (Item | Value) covering the primary CWE, attack vector, impact, and prerequisites.
- Section 4 must include exactly one flow fence in this form (3-6 steps, "label(note)" allowed, last step = final impact):
  \`\`\`flow
  step1(note) -> step2 -> step3 -> impact
  \`\`\`
- In section 6, if you found the real patch diff, quote only the key part in a \`\`\`diff-<lang> fence (e.g. diff-c, diff-python)
  and explain why that line breaks the flow.
- Section 7 uses the subheadings "Immediate actions / Detection / Isolated practice (local Docker lab)".
- Section 8 lists only official source links you actually confirmed, as a markdown list.`;

const SYSTEM_KO = `You are a translator for flaw2shell. Translate the given English CVE write-up into Korean.
This is a faithful translation, not a rewrite — do not add, drop, or change any facts.

Rules:
- Preserve the structure exactly: keep the 8 H2 headings with the same numbers (## 1. ~ ## 8.), all H3 subheadings,
  tables, lists, and links.
- Translate the H2 heading text to Korean using these names: 1. TL;DR, 2. Flaw 분류, 3. 근본 원인,
  4. 익스플로잇 흐름(개념), 5. 트리거 조건, 6. 패치 분석, 7. 탐지·완화, 8. References.
- Keep every code/diff fence: \`\`\`flow, \`\`\`diff-c, \`\`\`diff-python, etc. Inside a \`\`\`flow fence translate only the
  prose labels and keep the -> arrows and structure. Inside \`\`\`diff-* fences keep the code lines verbatim (never translate code).
- Keep URLs, function names, file names, version numbers, CVE/CWE identifiers, and CVSS vectors unchanged.
- Section 7 subheadings in Korean: 즉시 조치 / 탐지 / 격리된 실습(로컬 Docker 랩).
- Tone: plain and precise.

Output format (write no other text):
TITLE: <Korean title, excluding the CVE number>
---BODY---
<Korean body>`;

function userPrompt(c) {
  return [
    `Write the explainer draft for this CVE.`,
    ``,
    `- ID: ${c.id}`,
    `- Published: ${c.published}`,
    `- CVSS: ${c.cvss} (${c.severity}) ${c.vector}`,
    `- NVD CWE: ${c.cwes.join(', ') || '(none — pick the single most appropriate CWE from the root cause)'}`,
    `- NVD description: ${c.description}`,
    ``,
    `Reference links (open with web_fetch to verify):`,
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

/** 번역 출력 → { title, body } */
function parseTranslation(text) {
  const start = text.indexOf('TITLE:');
  if (start < 0) throw new Error('번역 형식 오류: TITLE 없음');
  const t = text.slice(start);
  const [head, ...rest] = t.split(/^---BODY---\s*$/m);
  if (!rest.length) throw new Error('번역 형식 오류: ---BODY--- 없음');
  const title = head.match(/^TITLE:\s*(.+)$/m)?.[1].trim() ?? '';
  return {
    title: title.replace(/^CVE-\d{4}-\d+\s*[:：-]?\s*/, ''),
    body: rest.join('---BODY---').trim() + '\n',
  };
}

/** 영어 초안 작성 — 메인 언어. web_search/web_fetch 로 사실 확인. */
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

/** 영어 초안 → 한국어 번역 (서브). 웹 도구 없이 구조를 보존해 번역만 한다. */
export async function translateToKorean({ title, body }, { model }) {
  const client = new Anthropic();
  const input = `TITLE: ${title}\n---BODY---\n${body}`;
  const stream = client.beta.messages.stream({
    model,
    max_tokens: 64000,
    system: SYSTEM_KO,
    messages: [{ role: 'user', content: input }],
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  });
  const final = await stream.finalMessage();
  if (final.stop_reason === 'refusal') {
    throw new Error(`번역 거절됨 (${final.stop_details?.category ?? 'unknown'})`);
  }
  if (final.stop_reason === 'max_tokens') throw new Error('번역이 max_tokens 에서 잘림');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return parseTranslation(text);
}
