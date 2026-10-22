// @ts-check
/**
 * 스택 선택: Astro (static output)
 *
 * - 콘텐츠 우선 SSG: Content Collections + Zod 스키마로 파이프라인이 만든
 *   content/posts/*.md 의 프런트매터(§3)를 "빌드 시점에" 검증한다. 스키마가 깨지면 빌드가 실패한다.
 * - 기본 0 KB JS: 페이지는 순수 HTML/CSS로 나가고, 검색·퀴즈·토글처럼 꼭 필요한 곳에만
 *   작은 인라인 스크립트를 쓴다. (Next.js 정적 출력보다 런타임이 가볍다)
 * - remark/rehype 플러그인 체인으로 ```flow → 인라인 SVG, ```diff → added/removed 하이라이트,
 *   무기화 코드 차단(remark-safety)을 모두 빌드타임에 처리 → 런타임 외부 호출 없음.
 * - Shiki 내장 구문 강조(라이트/다크 듀얼 테마), 순수 정적 dist/ → Netlify/Vercel/GitHub Pages 어디든 배포.
 * (11ty도 후보였지만 타입 안전한 스키마 검증과 컴포넌트 모델 때문에 Astro를 택했다. Hugo는 Go 템플릿과
 *  커스텀 마크다운 변환 확장성이 떨어진다.)
 */
import { defineConfig } from 'astro/config';
import { rehypeHeadingIds } from '@astrojs/markdown-remark';
import remarkSafety from './src/plugins/remark-safety.mjs';
import remarkFlow from './src/plugins/remark-flow.mjs';
import remarkDiff from './src/plugins/remark-diff.mjs';
import rehypeSections from './src/plugins/rehype-sections.mjs';
import rehypeExternalLinks from './src/plugins/rehype-external-links.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://flaw2shell.example',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  output: 'static',
  markdown: {
    // 순서 중요: 안전성 검사 → flow/diff 변환
    remarkPlugins: [remarkSafety, remarkFlow, remarkDiff],
    // rehypeSections 가 8개 고정 섹션에 안정적인 id를 먼저 부여하고, rehypeHeadingIds 는 기존 id를 존중한다
    rehypePlugins: [rehypeSections, rehypeHeadingIds, rehypeExternalLinks],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      defaultColor: false,
      wrap: false,
    },
  },
});
