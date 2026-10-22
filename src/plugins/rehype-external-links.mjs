import { isEnFile } from './rehype-sections.mjs';

/**
 * - 외부 링크(References: 공식 어드바이저리/NVD/패치 커밋) → 새 탭 + noopener noreferrer
 * - H2/H3 에 앵커 링크(#) 추가 (텍스트 없는 링크라 목차 텍스트에 섞이지 않음)
 */
export default function rehypeExternalLinks() {
  return (tree, file) => {
    const en = isEnFile(file);
    const walk = (node) => {
      if (node.type !== 'element' && node.type !== 'root') return;
      if (node.type === 'element') {
        const href = node.tagName === 'a' ? String(node.properties?.href || '') : '';
        if (/^https?:\/\//i.test(href)) {
          node.properties.target = '_blank';
          node.properties.rel = ['noopener', 'noreferrer', 'external'];
          node.properties.className = [...(node.properties.className || []), 'ext'];
        }
        if ((node.tagName === 'h2' || node.tagName === 'h3') && node.properties?.id) {
          if (en && !String(node.properties.id).startsWith('en-')) node.properties.id = `en-${node.properties.id}`;
          node.children.push({
            type: 'element',
            tagName: 'a',
            properties: { href: `#${node.properties.id}`, className: ['anchor'], ariaHidden: 'true', tabIndex: -1 },
            children: [],
          });
        }
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
}
