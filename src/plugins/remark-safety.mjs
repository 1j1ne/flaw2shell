import { visit } from 'unist-util-visit';
import { findWeaponized } from './safety-patterns.mjs';

/**
 * 무기화 가능 코드가 본문에 섞여 들어오면(파이프라인 오류 등) 해당 블록을 렌더하지 않고
 * 차단 안내로 교체한다. F2S_STRICT_SAFETY=1 이면 빌드를 실패시킨다.
 */
export default function remarkSafety() {
  const strict = process.env.F2S_STRICT_SAFETY === '1';
  return (tree, file) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index == null) return;
      if (!['code', 'inlineCode', 'html', 'text'].includes(node.type)) return;
      const hits = findWeaponized(node.value);
      if (!hits.length) return;
      const where = file?.path || file?.history?.[0] || '(unknown)';
      const msg = `[remark-safety] 무기화 패턴 차단 (${hits.join(', ')}) in ${where}`;
      if (strict) throw new Error(msg);
      console.warn(msg);
      const block = node.type === 'code' || node.type === 'html';
      parent.children[index] = block
        ? {
            type: 'html',
            value:
              '<div class="redacted" role="note"><strong>⚠ 렌더링 차단됨 · Redacted</strong>' +
              '<span>복붙 가능한 무기화 코드가 감지되어 이 블록을 제외했습니다. flaw2shell은 개념·원리만 다룹니다.</span></div>',
          }
        : { type: 'html', value: '<span class="redacted-inline">[무기화 코드 생략]</span>' };
    });
  };
}
