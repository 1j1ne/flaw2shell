/**
 * 콘텐츠 스키마 (★ CVE 수집 파이프라인과 1:1 일치 — §3)
 *
 *   id, cvss, severity, cwe, cwe_label, status, difficulty?, generated_by?
 *
 * status 가 published 인 문서만 "엄격 검증 + 렌더" 대상이다.
 * needs_review / draft 문서는 필드가 덜 채워져 있어도 빌드를 깨지 않되 어디에도 렌더되지 않는다.
 * (게이트는 src/lib/posts.ts 와 scripts/verify-build.mjs 에서 이중으로 강제)
 *
 * 파이프라인 스키마 밖의 선택 필드(title, date, summary, tags, track, quiz, sample)는 모두 optional —
 * 없으면 본문/파일 메타데이터에서 추정한다.
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const DIFFICULTIES = ['intro', 'intermediate', 'advanced'] as const;

const quizItem = z.object({
  q: z.string(),
  choices: z.array(z.string()).min(2).max(6),
  answer: z.number().int().min(0),
  explain: z.string().optional(),
});

/** 챌린지 텍스트는 문자열 또는 {ko,en} (T 와 동일) */
const i18nText = z.union([z.string(), z.object({ ko: z.string(), en: z.string() })]);

/** 🚩 선택 CTF 챌린지 블록 — 정답 평문이 아니라 SHA-256 해시만 둔다 */
const challenge = z.object({
  flag_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'flag_sha256 는 64자리 소문자 hex (평문 플래그는 넣지 말 것)'),
  flag_format: z.string().optional(),
  env: z.enum(['docker-isolated', 'vulhub']).default('docker-isolated'),
  lab: z.string().optional(),      // labs/<path> (기본값: labs/<id>)
  vulhub: z.string().optional(),   // vulhub 저장소 경로 (env: vulhub)
  objective: i18nText.optional(),
  tasks: z.array(i18nText).default([]),
  hints: z.array(i18nText).default([]),
});

/** 파이프라인 필수 필드 — published 일 때 엄격 적용 */
const strict = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'id 는 URL-safe 해야 함 (예: CVE-2026-6722)'),
  cvss: z.number().min(0).max(10),
  severity: z.enum(SEVERITIES),
  cwe: z.string().regex(/^CWE-\d+$/, 'cwe 는 CWE-<번호> 형식'),
  cwe_label: z.string().min(1),
  status: z.literal('published'),
  difficulty: z.enum(DIFFICULTIES).optional(),
  generated_by: z.string().optional(),
});

const posts = defineCollection({
  // 최상위 *.md 만 (content/posts/en/ 번역, content/drafts/ 는 포함되지 않음)
  loader: glob({
    pattern: ['*.md', '!_*.md'],
    base: './content/posts',
    generateId: ({ entry, data }) => String(data.id ?? entry.replace(/\.md$/, '')),
  }),
  schema: z
    .object({
      id: z.string(),
      status: z.string(),
      cvss: z.coerce.number().optional(),
      severity: z.string().optional(),
      cwe: z.string().optional(),
      cwe_label: z.string().optional(),
      difficulty: z.string().optional(),
      generated_by: z.string().optional(),
      // --- 선택 확장 필드 ---
      title: z.string().optional(),
      date: z.coerce.date().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()).default([]),
      track: z.enum(['ai']).optional(),
      sample: z.boolean().default(false),
      quiz: z.array(quizItem).default([]),
      challenge: challenge.optional(),
    })
    .passthrough()
    .superRefine((d, ctx) => {
      if (d.status !== 'published') return; // 비공개 문서는 렌더하지 않으므로 느슨하게
      const r = strict.safeParse(d);
      if (!r.success) for (const issue of r.error.issues) ctx.addIssue(issue);
      for (const [i, q] of (d.quiz ?? []).entries()) {
        if (q.answer >= q.choices.length)
          ctx.addIssue({ code: 'custom', path: ['quiz', i, 'answer'], message: 'answer 인덱스가 choices 범위를 벗어남' });
      }
    }),
});

/** 선택적 영문 번역: content/posts/en/<id>.md (프런트매터 id 는 원문과 동일) */
const postsEn = defineCollection({
  loader: glob({
    pattern: ['*.md', '!_*.md'],
    base: './content/posts/en',
    generateId: ({ entry, data }) => String(data.id ?? entry.replace(/\.md$/, '')),
  }),
  schema: z
    .object({
      id: z.string(),
      title: z.string().optional(),
      summary: z.string().optional(),
      // 번역 문제: answer 는 원문 것을 쓰므로 생략 가능
      quiz: z.array(quizItem.partial({ answer: true })).default([]),
    })
    .passthrough(),
});

export const collections = { posts, postsEn };
