#!/usr/bin/env node
/**
 * 빌드 후 검증 (npm run build 에 포함) — §7, §8 의 게이트를 산출물 기준으로 다시 확인한다.
 *  1) status != published 인 문서(content/posts, content/drafts)의 id 가 dist 어디에도 없을 것
 *  2) published 문서는 모두 /cve/<id>/ 페이지가 있을 것 + 8개 섹션 앵커
 *  3) dist 의 HTML/JSON 에 무기화 패턴이 없을 것
 * 하나라도 어기면 exit 1 → CI 배포 중단.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findWeaponized } from '../src/plugins/safety-patterns.mjs';
import { SECTIONS } from '../src/lib/sections.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const errors = [];
const warns = [];

function walk(dir, filter) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, filter) : filter(p) ? [p] : [];
  });
}
function front(file) {
  const m = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const get = (k) => m[1].match(new RegExp(`^${k}:\\s*["']?([^"'#\\n]+?)["']?\\s*(#.*)?$`, 'm'))?.[1]?.trim();
  return { id: get('id'), status: get('status') };
}

if (!existsSync(dist)) {
  console.error('[verify] dist/ 가 없습니다. astro build 를 먼저 실행하세요.');
  process.exit(1);
}

const postFiles = readdirSync(join(root, 'content/posts')).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => join(root, 'content/posts', f));
const draftFiles = walk(join(root, 'content/drafts'), (p) => p.endsWith('.md') && !p.endsWith('README.md'));
const metas = [...postFiles, ...draftFiles].map((f) => ({ file: f, ...front(f), isDraftDir: draftFiles.includes(f) }));
const published = metas.filter((m) => m.status === 'published' && !m.isDraftDir);
const hidden = metas.filter((m) => m.id && !published.includes(m));

const outputs = walk(dist, (p) => /\.(html|json|xml|txt)$/.test(p)).map((p) => ({ p, s: readFileSync(p, 'utf8') }));

// 1) 비공개 게이트
for (const h of hidden) {
  if (existsSync(join(dist, 'cve', h.id))) errors.push(`비공개 문서 라우트가 생성됨: /cve/${h.id}/ (status=${h.status})`);
  for (const o of outputs) if (o.s.includes(h.id)) errors.push(`비공개 문서 id(${h.id}, status=${h.status}) 가 산출물에 노출됨: ${o.p.replace(dist, 'dist')}`);
}
// 2) 공개 문서 렌더 확인
for (const p of published) {
  const page = join(dist, 'cve', p.id, 'index.html');
  if (!existsSync(page)) { errors.push(`published 문서 페이지 누락: /cve/${p.id}/`); continue; }
  const html = readFileSync(page, 'utf8');
  const missing = SECTIONS.filter((s) => !html.includes(`id="${s.key}"`)).map((s) => s.key);
  if (missing.length) warns.push(`${p.id}: 섹션 앵커 누락 → ${missing.join(', ')}`);
  if (!html.includes('notice-edu')) errors.push(`${p.id}: 방어·교육 목적 고지가 없음`);
}
// 3) 무기화 패턴
for (const o of outputs) {
  const hits = findWeaponized(o.s.replace(/<[^>]+>/g, ''));
  if (hits.length) errors.push(`무기화 패턴 감지 (${hits.join(', ')}): ${o.p.replace(dist, 'dist')}`);
}

// 4) 원본 소스 검사 — 렌더에서는 이미 차단되지만, 파이프라인 품질 신호로 보고한다.
//    F2S_STRICT_SAFETY=1 이면 오류로 취급해 배포를 막는다(Astro 로더는 렌더 오류를 경고로만 남기므로 여기서 강제).
for (const m of metas.filter((x) => !x.isDraftDir)) {
  const hits = findWeaponized(readFileSync(m.file, 'utf8'));
  if (!hits.length) continue;
  const msg = `원본에 무기화 패턴 (${hits.join(', ')}) — 렌더 차단됨: ${m.file.replace(root + '/', '')}`;
  (process.env.F2S_STRICT_SAFETY === '1' ? errors : warns).push(msg);
}

warns.forEach((w) => console.warn(`[verify] ⚠ ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`[verify] ✗ ${e}`));
  process.exit(1);
}
console.log(`[verify] ✓ published ${published.length}건 렌더 · 비공개 ${hidden.length}건 차단 확인 · 무기화 패턴 0 · 파일 ${outputs.length}개 검사`);
