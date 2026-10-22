import { visit } from 'unist-util-visit';
import { findWeaponized } from './safety-patterns.mjs';

/**
 * ```flow 펜스 → 단계 다이어그램(인라인 SVG).
 *   트리거(중복키로 해제) -> 힙 재점유(문자열 할당) -> dangling 포인터 역참조 -> RCE
 * - "라벨(보조설명)" 형식이면 보조설명을 작은 글씨로 렌더
 * - 데스크톱: 가로 스텝 플로우 / 모바일: 세로 스텝 플로우 (CSS로 전환)
 * - 색은 CSS 변수로 지정 → 라이트/다크 모두 가독
 * - 명령어처럼 보이는 단계는 렌더하지 않는다(§7)
 */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isWide = (ch) => /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch);
const textWidth = (s, px) => [...s].reduce((w, ch) => w + (isWide(ch) ? px : px * 0.58), 0);

function wrap(text, maxWidth, px, maxLines = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  const push = (w) => {
    const next = cur ? `${cur} ${w}` : w;
    if (textWidth(next, px) <= maxWidth) return void (cur = next);
    if (cur) lines.push(cur);
    // 단어 자체가 너무 길면 글자 단위로 자른다
    let piece = '';
    for (const ch of w) {
      if (textWidth(piece + ch, px) > maxWidth) {
        lines.push(piece);
        piece = ch;
      } else piece += ch;
    }
    cur = piece;
  };
  words.forEach(push);
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.$/, '…');
    return kept;
  }
  return lines;
}

const COMMANDISH = /`|\$\(|\|\s*\w|;\s*\w|&&|https?:\/\/|\b(sudo|chmod|curl|wget|nc|bash|powershell)\b/i;

export function parseFlow(src) {
  return src
    .split(/->|→|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^(.*?)\s*[(（](.+)[)）]\s*$/);
      let label = (m ? m[1] : raw).trim();
      let detail = m ? m[2].trim() : '';
      let redacted = false;
      if (findWeaponized(raw).length || COMMANDISH.test(raw)) {
        label = '[명령 생략]';
        detail = '개념 단계만 표시';
        redacted = true;
      }
      return { label, detail, redacted };
    });
}

const MAIN_PX = 14;
const SUB_PX = 12;

function stepBox(step, i, total, x, y, w, h, labelLines, detailLines) {
  const cls = ['flow-step', i === total - 1 ? 'is-impact' : '', step.redacted ? 'is-redacted' : '']
    .filter(Boolean)
    .join(' ');
  const cx = x + w / 2;
  let out = `<g class="${cls}">`;
  out += `<rect class="flow-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
  out += `<text class="flow-num" x="${x + 12}" y="${y + 20}">${String(i + 1).padStart(2, '0')}</text>`;
  const blockH = labelLines.length * 19 + (detailLines.length ? 6 + detailLines.length * 16 : 0);
  let ty = y + 26 + (h - 26 - blockH) / 2 + 14;
  for (const l of labelLines) {
    out += `<text class="flow-label" x="${cx}" y="${ty}" text-anchor="middle">${esc(l)}</text>`;
    ty += 19;
  }
  if (detailLines.length) ty += 4;
  for (const l of detailLines) {
    out += `<text class="flow-detail" x="${cx}" y="${ty}" text-anchor="middle">${esc(l)}</text>`;
    ty += 16;
  }
  return out + '</g>';
}

function arrowDefs(id) {
  return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="flow-arrowhead"/></marker></defs>`;
}

export function renderFlowSvg(steps, uid) {
  const n = steps.length;
  // ---- 가로 ----
  const W = 176, GAP = 40, PAD = 4;
  const inner = W - 20;
  const wrapped = steps.map((s) => ({
    l: wrap(s.label, inner, MAIN_PX),
    d: s.detail ? wrap(s.detail, inner, SUB_PX) : [],
  }));
  const contentH = Math.max(...wrapped.map((w) => w.l.length * 19 + (w.d.length ? 6 + w.d.length * 16 : 0)));
  const H = Math.max(96, 26 + contentH + 22);
  const totalW = n * W + (n - 1) * GAP + PAD * 2;
  const totalH = H + PAD * 2;
  let h = `<svg class="flow-h" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" style="--flow-min:${Math.min(totalW, n * 150)}px" aria-hidden="true" focusable="false">${arrowDefs(`${uid}-ah`)}`;
  steps.forEach((s, i) => {
    const x = PAD + i * (W + GAP);
    h += stepBox(s, i, n, x, PAD, W, H, wrapped[i].l, wrapped[i].d);
    if (i < n - 1) {
      const y = PAD + H / 2;
      h += `<line class="flow-arrow" x1="${x + W + 4}" y1="${y}" x2="${x + W + GAP - 5}" y2="${y}" marker-end="url(#${uid}-ah)"/>`;
    }
  });
  h += '</svg>';

  // ---- 세로(모바일) ----
  const VW = 320, VGAP = 30;
  const vInner = VW - 64;
  const vw = steps.map((s) => ({
    l: wrap(s.label, vInner, MAIN_PX),
    d: s.detail ? wrap(s.detail, vInner, SUB_PX) : [],
  }));
  const heights = vw.map((w) => Math.max(64, 26 + w.l.length * 19 + (w.d.length ? 6 + w.d.length * 16 : 0) + 14));
  const vTotalH = heights.reduce((a, b) => a + b, 0) + (n - 1) * VGAP + PAD * 2;
  let v = `<svg class="flow-v" viewBox="0 0 ${VW + PAD * 2} ${vTotalH}" aria-hidden="true" focusable="false">${arrowDefs(`${uid}-av`)}`;
  let y = PAD;
  steps.forEach((s, i) => {
    v += stepBox(s, i, n, PAD, y, VW, heights[i], vw[i].l, vw[i].d);
    if (i < n - 1) {
      const x = PAD + VW / 2;
      v += `<line class="flow-arrow" x1="${x}" y1="${y + heights[i] + 3}" x2="${x}" y2="${y + heights[i] + VGAP - 4}" marker-end="url(#${uid}-av)"/>`;
    }
    y += heights[i] + VGAP;
  });
  v += '</svg>';

  const list = steps
    .map((s) => `<li>${esc(s.label)}${s.detail ? ` — ${esc(s.detail)}` : ''}</li>`)
    .join('');
  return (
    `<figure class="flow" role="group" aria-label="익스플로잇 흐름 (개념)">` +
    `<div class="flow-scroll">${h}${v}</div>` +
    `<ol class="sr-only">${list}</ol>` +
    `<figcaption>개념 흐름도 · Conceptual flow — 실행 가능한 페이로드가 아닙니다</figcaption>` +
    `</figure>`
  );
}

export default function remarkFlow() {
  return (tree, file) => {
    // KO/EN 본문이 한 페이지에 함께 들어가므로 marker id가 겹치지 않게 파일 경로로 접두어를 만든다
    const key = String(file?.path || file?.history?.[0] || '');
    let hash = 0;
    for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const prefix = `f${hash.toString(36)}`;
    let count = 0;
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang !== 'flow' || !parent) return;
      const steps = parseFlow(node.value);
      if (!steps.length) return;
      parent.children[index] = { type: 'html', value: renderFlowSvg(steps, `${prefix}-${count++}`) };
    });
  };
}
