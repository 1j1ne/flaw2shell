#!/usr/bin/env node
/**
 * flaw2shell CVE 파이프라인
 *
 *   1) 수집   NVD 에서 최근 공개 CVE
 *   2) 선별   CVSS 기준 + 이미 있는 글 제외
 *   3) 초안   Claude API 로 8섹션 해설 작성
 *   4) 저장   content/posts/<id>.md  (status: needs_review — 공개되지 않음)
 *   5) 알림   검토 요청 메일 (CI 에서는 PR 생성 후 notify.mjs 가 PR 링크와 함께 발송)
 *
 * 사용: npm run pipeline            (로컬: 초안 생성 + SMTP 설정 시 메일)
 *       npm run pipeline -- --no-mail
 * 결과 요약은 pipeline-output.json 에 남는다 (CI 가 PR 본문/메일에 사용).
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.mjs';
import { fetchRecentCves, select } from './nvd.mjs';
import { writeDraft, translateToKorean } from './draft.mjs';
import { sendReviewMail } from './notify.mjs';
import { findWeaponized } from '../src/plugins/safety-patterns.mjs';
import { SECTIONS, matchSection } from '../src/lib/sections.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const POSTS = join(root, 'content/posts');
const OUTPUT = join(root, 'pipeline-output.json');

function existingIds() {
  const ids = new Set();
  for (const dir of ['content/posts', 'content/posts/en', 'content/drafts']) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs).filter((x) => x.endsWith('.md'))) {
      ids.add(f.replace(/\.md$/, ''));
      const m = readFileSync(join(abs, f), 'utf8').match(/^id:\s*["']?([^"'\s#]+)/m);
      if (m) ids.add(m[1]);
    }
  }
  return ids;
}

/** 생성물 자동 검사: 무기화 패턴 제거, 섹션·flow 확인 */
function check(body) {
  const warnings = [];
  const kept = [];
  let removed = 0;
  for (const line of body.split('\n')) {
    if (findWeaponized(line).length) removed++;
    else kept.push(line);
  }
  if (removed) warnings.push(`무기화 패턴이 있는 ${removed}줄을 자동 삭제함 — 주변 문맥 확인 필요`);
  const out = kept.join('\n');
  const heads = [...out.matchAll(/^##\s+(.+)$/gm)].map((m) => matchSection(m[1])?.key).filter(Boolean);
  const missing = SECTIONS.filter((s) => !heads.includes(s.key)).map((s) => s.key);
  if (missing.length) warnings.push(`누락된 섹션: ${missing.join(', ')}`);
  if (heads.join() !== SECTIONS.map((s) => s.key).filter((k) => heads.includes(k)).join()) warnings.push('섹션 순서가 규칙과 다름');
  if (!/```flow\n/.test(out)) warnings.push('4장에 ```flow 다이어그램이 없음');
  if (!/```diff/.test(out)) warnings.push('6장에 실제 패치 diff 가 없음 (개념 설명만 있음)');
  return { body: out, warnings };
}

const q = (s) => JSON.stringify(String(s)); // YAML 에서도 유효한 큰따옴표 문자열

function toMarkdown(c, d) {
  const cwe = /^CWE-\d+$/.test(d.cwe) ? d.cwe : c.cwes[0];
  const fm = [
    '---',
    `id: ${c.id}`,
    `cvss: ${c.cvss}`,
    `severity: ${c.severity}`,
    `cwe: ${cwe ?? 'CWE-0'}`,
    `cwe_label: ${q(d.cweLabel || 'Unknown')}`,
    `status: needs_review`,
    d.difficulty ? `difficulty: ${d.difficulty}` : null,
    `generated_by: pipeline`,
    `title: ${q(d.title || c.id)}`,
    `date: ${(c.published || new Date().toISOString()).slice(0, 10)}`,
    '---',
    '',
  ].filter((x) => x !== null);
  return { md: fm.join('\n') + d.body, cwe };
}

/** 영어 번역 파일(content/posts/en/<id>.md) — 표시 메인. 메타데이터는 기본 파일에만 둔다. */
function toMarkdownEn(c, d) {
  const fm = ['---', `id: ${c.id}`, `title: ${q(d.title || c.id)}`, '---', ''];
  return fm.join('\n') + d.body;
}

async function main() {
  const noMail = process.argv.includes('--no-mail');
  const result = { ranAt: new Date().toISOString(), candidates: 0, drafts: [], errors: [] };

  console.log(`[pipeline] NVD 수집: 최근 ${config.lookbackHours}시간`);
  const raw = await fetchRecentCves({ lookbackHours: config.lookbackHours, apiKey: config.nvdApiKey });
  const picked = select(raw, { minCvss: config.minCvss, maxDrafts: config.maxDrafts, existingIds: existingIds() });
  result.candidates = raw.length;
  console.log(`[pipeline] 수집 ${raw.length}건 → 선별 ${picked.length}건 (CVSS ≥ ${config.minCvss}, 최대 ${config.maxDrafts})`);
  picked.forEach((c) => console.log(`  - ${c.id} CVSS ${c.cvss} ${c.cwes.join(',')}${c.hasPatchRef ? ' [patch]' : ''}`));

  if (config.dryRun) {
    console.log('[pipeline] F2S_DRY_RUN=1 — 초안 작성 생략');
  } else {
    for (const c of picked) {
      try {
        console.log(`[pipeline] ${c.id} 영어 초안 작성 중 (${config.model})…`);
        const d = await writeDraft(c, { model: config.model });            // 영어 = 메인
        const en = check(d.body);
        console.log(`[pipeline] ${c.id} 한국어 번역 중…`);
        const ko = await translateToKorean({ title: d.title, body: en.body }, { model: config.model }); // 한국어 = 서브
        const koc = check(ko.body);
        const warnings = [...en.warnings, ...koc.warnings.map((w) => `KO: ${w}`)];
        // 메인 파일(content/posts/<id>.md): 메타데이터 + 한국어 본문(렌더 측 body-ko)
        const { md, cwe } = toMarkdown(c, { ...d, title: ko.title, body: koc.body });
        if (!cwe) warnings.push('CWE 를 정하지 못함 — 프런트매터 cwe 수정 필요');
        const file = `content/posts/${c.id}.md`;
        writeFileSync(join(root, file), md);
        // 번역 파일(content/posts/en/<id>.md): 영어 본문(렌더 측 body-en, 기본 표시 언어)
        const enFile = `content/posts/en/${c.id}.md`;
        mkdirSync(join(root, 'content/posts/en'), { recursive: true });
        writeFileSync(join(root, enFile), toMarkdownEn(c, { title: d.title, body: en.body }));
        result.drafts.push({
          id: c.id, file, title: d.title, cvss: c.cvss, severity: c.severity,
          cwe: cwe ?? '', cweLabel: d.cweLabel, reviewNotes: d.reviewNotes || '- 없음', warnings, model: d.model,
        });
        console.log(`[pipeline] ✓ ${file} + ${enFile}${warnings.length ? ` (경고 ${warnings.length})` : ''}`);
      } catch (e) {
        console.error(`[pipeline] ✗ ${c.id}: ${e.message}`);
        result.errors.push({ id: c.id, error: e.message });
      }
    }
  }

  writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
  // CI 에서는 PR 을 만든 뒤 notify.mjs 가 PR 링크와 함께 보낸다
  if (!process.env.CI && !noMail) await sendReviewMail(result);
  console.log(`[pipeline] 완료: 초안 ${result.drafts.length}건, 오류 ${result.errors.length}건`);
}

main().catch((e) => {
  console.error('[pipeline] 실패:', e);
  process.exit(1);
});
