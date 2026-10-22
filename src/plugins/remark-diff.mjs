import { visit } from 'unist-util-visit';
import { codeToHtml } from 'shiki';

/**
 * ```diff / ```diff-c / ```diff-python … 펜스 → added/removed 라인 하이라이트.
 * "diff-<lang>" 이면 +/- 접두어를 뗀 코드를 해당 언어로 구문 강조한 뒤 줄마다 상태 클래스를 붙인다.
 * 패치 분석(§6) 섹션의 실제 fix diff 가독성을 위한 것.
 */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function classify(line) {
  if (/^(\+\+\+|---)\s/.test(line)) return 'meta';
  if (line.startsWith('@@')) return 'hunk';
  if (/^(diff --git|index [0-9a-f]+)/.test(line)) return 'meta';
  if (line.startsWith('+')) return 'add';
  if (line.startsWith('-')) return 'del';
  return 'ctx';
}

export default function remarkDiff() {
  return async (tree) => {
    const jobs = [];
    visit(tree, 'code', (node, index, parent) => {
      if (!parent || !node.lang || !/^diff(-[\w+#.-]+)?$/.test(node.lang)) return;
      jobs.push({ node, index, parent });
    });
    for (const { node, index, parent } of jobs) {
      const inner = node.lang.includes('-') ? node.lang.slice(5) : 'text';
      const raw = node.value.replace(/\n$/, '').split('\n');
      const kinds = raw.map(classify);
      const code = raw.map((l, i) => (['add', 'del', 'ctx'].includes(kinds[i]) ? l.slice(1) : l)).join('\n');
      let html;
      try {
        html = await codeToHtml(code, {
          lang: inner,
          themes: { light: 'github-light', dark: 'github-dark-dimmed' },
          defaultColor: false,
          transformers: [
            {
              line(el, n) {
                const k = kinds[n - 1];
                this.addClassToHast(el, ['diff-line', `diff-${k}`]);
                const sign = { add: '+', del: '-', ctx: ' ', hunk: '', meta: '' }[k];
                el.properties['data-sign'] = sign;
              },
              pre(el) {
                this.addClassToHast(el, ['astro-code', 'diff-block']);
              },
            },
          ],
        });
      } catch {
        html =
          '<pre class="astro-code diff-block"><code>' +
          raw.map((l, i) => `<span class="line diff-line diff-${kinds[i]}">${esc(l)}</span>`).join('\n') +
          '</code></pre>';
      }
      const added = kinds.filter((k) => k === 'add').length;
      const removed = kinds.filter((k) => k === 'del').length;
      parent.children[index] = {
        type: 'html',
        value:
          `<figure class="diff" aria-label="패치 diff: ${added}줄 추가, ${removed}줄 삭제">` +
          `<figcaption><span class="diff-stat add">+${added}</span><span class="diff-stat del">−${removed}</span>` +
          `<span class="diff-lang">${esc(inner === 'text' ? 'diff' : inner)}</span></figcaption>${html}</figure>`,
      };
    }
  };
}
