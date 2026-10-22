/**
 * 포스트 데이터 레이어 — 모든 페이지/엔드포인트는 이 모듈만 통해 포스트를 읽는다.
 * ★ status: published 게이트를 여기서 강제한다 (빌드 측). 렌더 측 가드는 PostLayout,
 *   산출물 검증은 scripts/verify-build.mjs.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { statSync } from 'node:fs';
import { AI_CWES, getCwe, type Difficulty } from '../data/cwe';
import { SECTIONS, matchSection } from './sections.mjs';
import { findWeaponized } from '../plugins/safety-patterns.mjs';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export interface Post {
  id: string;
  entry: CollectionEntry<'posts'>;
  en?: CollectionEntry<'postsEn'>;
  title: string;
  titleEn?: string;
  summary: string;
  summaryEn?: string;
  cvss: number;
  severity: Severity;
  cwe: string;
  cweLabel: string;
  difficulty: Difficulty;
  difficultyInferred: boolean;
  generatedBy?: string;
  date: Date;
  tags: string[];
  isAi: boolean;
  sample: boolean;
  /** 본문에서 찾지 못한 고정 섹션 key 목록 */
  missingSections: string[];
  /** 검색용 평문 */
  text: string;
}

export const isPublished = (e: { data: { status?: string } }) => e.data.status === 'published';

/** §7: 무기화 패턴이 있는 줄은 검색 인덱스·요약·퀴즈 등 파생 텍스트에서도 제거 (렌더 측은 remark-safety) */
export const scrub = (md: string) =>
  md.split('\n').filter((line) => findWeaponized(line).length === 0).join('\n');

/** 마크다운 → 대략적 평문 (검색·요약용) */
export function toPlain(md: string): string {
  return md
    .replace(/```flow\n([\s\S]*?)```/g, (_, f) => f.replace(/->/g, '→'))
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^[#>\-*+|\s]+/gm, '')
    .replace(/[*_~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 본문을 H2 기준으로 잘라 섹션 key → 원문 마크다운 */
export function splitSections(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = body.split(/^##\s+(.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const sec = matchSection(parts[i]);
    if (sec && !(sec.key in out)) out[sec.key] = parts[i + 1] ?? '';
  }
  return out;
}

function firstSentences(md: string | undefined, max = 180): string {
  if (!md) return '';
  const plain = toPlain(md);
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('다. '));
  return end > 60 ? cut.slice(0, end + 1).trim() : cut.trim() + '…';
}

function fileDate(entry: CollectionEntry<'posts'>): Date {
  try {
    if (entry.filePath) return statSync(entry.filePath).mtime;
  } catch {}
  return new Date(0);
}

let cache: Post[] | null = null;

export async function getPublishedPosts(): Promise<Post[]> {
  if (cache) return cache;
  const [all, ens] = await Promise.all([getCollection('posts'), getCollection('postsEn')]);
  const enMap = new Map(ens.map((e) => [e.data.id, e]));

  const posts = all.filter(isPublished).map((entry): Post => {
    const d = entry.data as typeof entry.data & {
      cvss: number; severity: Severity; cwe: string; cwe_label: string; difficulty?: Difficulty;
    };
    const en = enMap.get(d.id);
    const body = scrub(entry.body ?? '');
    const secs = splitSections(body);
    const enBody = scrub(en?.body ?? '');
    const enSecs = enBody ? splitSections(enBody) : {};
    const cat = getCwe(d.cwe);
    const tags = d.tags ?? [];
    const sevFromCvss = d.cvss >= 9 ? 'CRITICAL' : d.cvss >= 7 ? 'HIGH' : d.cvss >= 4 ? 'MEDIUM' : 'LOW';
    if (sevFromCvss !== d.severity)
      console.warn(`[posts] ${d.id}: severity(${d.severity}) 와 CVSS ${d.cvss} 등급(${sevFromCvss})이 다릅니다 (프런트매터 값 사용)`);
    const missing = SECTIONS.filter((s) => !(s.key in secs)).map((s) => s.key);
    if (missing.length) console.warn(`[posts] ${d.id}: 고정 섹션 누락 → ${missing.join(', ')}`);

    return {
      id: d.id,
      entry,
      en,
      title: d.title ?? `${d.id}: ${d.cwe_label}`,
      titleEn: en?.data.title,
      summary: d.summary ?? firstSentences(secs.tldr),
      summaryEn: en?.data.summary ?? (enSecs.tldr ? firstSentences(enSecs.tldr) : undefined),
      cvss: d.cvss,
      severity: d.severity,
      cwe: d.cwe,
      cweLabel: d.cwe_label,
      difficulty: d.difficulty ?? cat?.difficulty ?? 'intermediate',
      difficultyInferred: !d.difficulty,
      generatedBy: d.generated_by,
      date: d.date ?? fileDate(entry),
      tags,
      isAi:
        d.track === 'ai' || AI_CWES.has(d.cwe) || tags.some((t) => /^(ai|llm|ml|genai)$/i.test(t)),
      sample: !!d.sample,
      missingSections: missing,
      text: toPlain(`${d.title ?? ''} ${body} ${enBody}`),
    };
  });

  posts.sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
  cache = posts;
  return posts;
}

export const fmtDate = (d: Date) =>
  d.getTime() === 0 ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
