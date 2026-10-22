/**
 * 퀴즈/플래시카드 생성기 (빌드타임).
 * - 포스트 메타데이터(CWE, CVSS)에서 자동 생성되는 문제
 * - 포스트 프런트매터의 선택 필드 quiz: [...] (사람이 쓴 문제, 영문은 번역본 quiz 의 같은 인덱스)
 * - CWE 카탈로그 기반 "클래스 드릴" 문제
 */
import { CWE_CATALOG, getCwe, type CweInfo } from '../data/cwe';
import type { Post } from './posts';
import type { Str } from './i18n';

export interface QuizQ {
  id: string;
  source: 'post' | 'class';
  post?: string;
  cwe: string;
  difficulty: string;
  q: Str;
  choices: Str[];
  answer: number;
  explain?: Str;
}
export interface Card {
  id: string;
  kind: 'post' | 'class';
  front: Str;
  back: Str;
  href: string;
}

const same = (s: string): Str => ({ ko: s, en: s });

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h;
}
/** 결정적 의사난수 선택 — 빌드마다 같은 결과 */
function pick<T>(arr: T[], n: number, seed: string): T[] {
  return [...arr].sort((a, b) => hash(seed + JSON.stringify(a)) - hash(seed + JSON.stringify(b))).slice(0, n);
}
/** 정답을 보기 사이에 결정적으로 섞는다 */
function place(correct: Str, wrong: Str[], seed: string) {
  const pos = hash(seed) % (wrong.length + 1);
  const choices = [...wrong];
  choices.splice(pos, 0, correct);
  return { choices, answer: pos };
}

const band = (cvss: number) => (cvss >= 9 ? 3 : cvss >= 7 ? 2 : cvss >= 4 ? 1 : 0);
const BANDS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function distractors(cwe: string, seed: string, n = 3): CweInfo[] {
  const me = getCwe(cwe);
  const pool = CWE_CATALOG.filter((x) => x.id !== cwe);
  // 같은 계열을 우선 섞어 너무 쉬운 보기가 되지 않게
  const sameFam = pool.filter((x) => me && x.family === me.family);
  const near = pick(sameFam, Math.min(2, sameFam.length), seed);
  return [...near, ...pick(pool.filter((x) => !near.includes(x)), n - near.length, seed + 'x')];
}

export function buildQuiz(posts: Post[]): QuizQ[] {
  const qs: QuizQ[] = [];
  for (const p of posts) {
    const base = { source: 'post' as const, post: p.id, cwe: p.cwe, difficulty: p.difficulty };
    const cat = getCwe(p.cwe);

    // 1) 클래스 식별
    {
      const correct = same(`${p.cwe} · ${cat?.name.en ?? p.cweLabel}`);
      const wrong = distractors(p.cwe, p.id).map((x) => same(`${x.id} · ${x.name.en}`));
      qs.push({
        ...base, id: `${p.id}-class`,
        q: { ko: `${p.id}의 1차 취약점 클래스(CWE)는?`, en: `What is the primary weakness class (CWE) of ${p.id}?` },
        ...place(correct, wrong, p.id + 'class'),
        explain: { ko: `${p.title} — ${cat?.desc.ko ?? p.cweLabel}`, en: `${p.titleEn ?? p.title} — ${cat?.desc.en ?? p.cweLabel}` },
      });
    }
    // 2) CVSS 정성 등급
    qs.push({
      ...base, id: `${p.id}-cvss`,
      q: {
        ko: `${p.id}의 CVSS v3 기본 점수는 ${p.cvss}입니다. 정성 등급은?`,
        en: `${p.id} has a CVSS v3 base score of ${p.cvss}. What is its qualitative rating?`,
      },
      choices: BANDS.map(same),
      answer: band(p.cvss),
      explain: {
        ko: 'CVSS v3.x 등급: 0.1–3.9 Low · 4.0–6.9 Medium · 7.0–8.9 High · 9.0–10.0 Critical',
        en: 'CVSS v3.x ratings: 0.1–3.9 Low · 4.0–6.9 Medium · 7.0–8.9 High · 9.0–10.0 Critical',
      },
    });
    // 3) 패치 방향
    if (cat) {
      const wrong = distractors(p.cwe, p.id + 'fix').map((x) => x.fix);
      qs.push({
        ...base, id: `${p.id}-fix`,
        q: {
          ko: `${p.id}(${cat.name.ko}) 같은 결함을 막는 전형적인 패치 방향은?`,
          en: `What is the typical fix direction for a flaw like ${p.id} (${cat.name.en})?`,
        },
        ...place(cat.fix, wrong, p.id + 'fixpos'),
        explain: cat.pattern,
      });
    }
    // 4) 사람이 쓴 문제
    p.entry.data.quiz.forEach((item, i) => {
      const en = p.en?.data.quiz?.[i];
      qs.push({
        ...base, id: `${p.id}-q${i}`,
        q: { ko: item.q, en: en?.q ?? item.q },
        choices: item.choices.map((c, j) => ({ ko: c, en: en?.choices?.[j] ?? c })),
        answer: item.answer,
        explain: item.explain ? { ko: item.explain, en: en?.explain ?? item.explain } : undefined,
      });
    });
  }
  // 클래스 드릴: 정의 → CWE
  for (const c of CWE_CATALOG) {
    const wrong = distractors(c.id, 'drill' + c.id).map((x) => same(`${x.id} · ${x.name.en}`));
    qs.push({
      id: `drill-${c.id}`, source: 'class', cwe: c.id, difficulty: c.difficulty,
      q: { ko: `다음 정의에 해당하는 CWE는? — “${c.desc.ko}”`, en: `Which CWE matches this definition? — “${c.desc.en}”` },
      ...place(same(`${c.id} · ${c.name.en}`), wrong, 'drillpos' + c.id),
      explain: c.pattern,
    });
  }
  return qs;
}

export function buildCards(posts: Post[], base: string): Card[] {
  const cards: Card[] = posts.map((p) => ({
    id: `card-${p.id}`, kind: 'post',
    front: same(p.id),
    back: { ko: `${p.title}\n\n${p.cwe} · ${p.cweLabel} · CVSS ${p.cvss}\n\n${p.summary}`, en: `${p.titleEn ?? p.title}\n\n${p.cwe} · ${p.cweLabel} · CVSS ${p.cvss}\n\n${p.summaryEn ?? p.summary}` },
    href: `${base}cve/${p.id}/`,
  }));
  for (const c of CWE_CATALOG) {
    cards.push({
      id: `card-${c.id}`, kind: 'class',
      front: { ko: `${c.id}\n${c.name.ko}`, en: `${c.id}\n${c.name.en}` },
      back: { ko: `${c.desc.ko}\n\n패치: ${c.fix.ko}`, en: `${c.desc.en}\n\nFix: ${c.fix.en}` },
      href: `${base}class/${c.id}/`,
    });
  }
  return cards;
}
