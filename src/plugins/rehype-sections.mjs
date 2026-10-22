import { matchSection } from '../lib/sections.mjs';

/**
 * - 8개 고정 H2 섹션에 언어와 무관한 안정 id(#tldr, #patch …)를 부여 → 앵커가 파이프라인 문구 변화에 강하다
 *   (영문 번역 본문은 같은 페이지에 함께 렌더되므로 en- 접두어)
 * - 각 H2 구간을 <section class="post-sec sec-{key}"> 로 감싸 섹션별 스타일링
 */
const textOf = (n) => (n.type === 'text' ? n.value : (n.children || []).map(textOf).join(''));

export const isEnFile = (file) => /[\\/]posts[\\/]en[\\/]/.test(String(file?.path || file?.history?.[0] || ''));

export default function rehypeSections() {
  return (tree, file) => {
    const prefix = isEnFile(file) ? 'en-' : '';
    const out = [];
    let current = null;
    const seen = new Set();
    for (const node of tree.children) {
      if (node.type === 'element' && node.tagName === 'h2') {
        const sec = matchSection(textOf(node));
        const key = sec && !seen.has(sec.key) ? sec.key : null;
        if (key) {
          seen.add(key);
          node.properties = { ...node.properties, id: prefix + key };
        }
        current = {
          type: 'element',
          tagName: 'section',
          properties: { className: ['post-sec', key ? `sec-${key}` : 'sec-extra'] },
          children: [],
        };
        out.push(current);
      }
      (current ? current.children : out).push(node);
    }
    tree.children = out;
  };
}
