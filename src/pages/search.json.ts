/** 클라이언트 사이드 검색 인덱스 (published 만). 외부 검색 서비스 없이 정적 JSON 하나. */
import type { APIRoute } from 'astro';
import { getPublishedPosts } from '../lib/posts';

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();
  const index = posts.map((p) => ({
    id: p.id,
    title: p.title,
    titleEn: p.titleEn ?? '',
    cwe: p.cwe,
    cweLabel: p.cweLabel,
    severity: p.severity,
    difficulty: p.difficulty,
    tags: p.tags,
    text: p.text.slice(0, 20000),
  }));
  return new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
