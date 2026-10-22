#!/usr/bin/env node
/**
 * 5) 검토 요청 메일 — pipeline-output.json 을 읽어 REVIEW_EMAIL 로 보낸다.
 *    SMTP 설정(SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)이 없으면 건너뛴다.
 *    사용: node pipeline/notify.mjs [PR_URL]
 */
import { readFileSync, existsSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { config } from './config.mjs';

const OUTPUT = new URL('../pipeline-output.json', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sendReviewMail(result, prUrl = '') {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!config.reviewEmail) return console.log('[notify] REVIEW_EMAIL 미설정 — 메일 생략');
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return console.log('[notify] SMTP 미설정 — 메일 생략');
  if (!result.drafts.length && !result.errors.length) return console.log('[notify] 새 초안 없음 — 메일 생략');

  const n = result.drafts.length;
  const subject = n
    ? `[flaw2shell] 검토 요청: 새 초안 ${n}건 (${result.drafts.map((d) => d.id).join(', ')})`
    : `[flaw2shell] 파이프라인 오류 ${result.errors.length}건`;

  const lines = [];
  const html = [];
  if (n) {
    lines.push(`검토가 필요한 초안 ${n}건이 생성되었습니다. 모두 status: needs_review 상태라 아직 공개되지 않습니다.`, '');
    html.push(`<p>검토가 필요한 초안 <b>${n}건</b>이 생성되었습니다. 모두 <code>status: needs_review</code> 상태라 아직 공개되지 않습니다.</p>`);
    if (prUrl) {
      lines.push(`검토 PR: ${prUrl}`, '');
      html.push(`<p><a href="${esc(prUrl)}">▶ 검토 PR 열기</a></p>`);
    }
    for (const d of result.drafts) {
      lines.push(`■ ${d.id} — ${d.title}`, `  CVSS ${d.cvss} ${d.severity} · ${d.cwe} ${d.cweLabel}`, `  파일: ${d.file}`);
      html.push(`<h3>${esc(d.id)} — ${esc(d.title)}</h3><p>CVSS ${d.cvss} ${esc(d.severity)} · ${esc(d.cwe)} ${esc(d.cweLabel)}<br>파일: <code>${esc(d.file)}</code><br><a href="https://nvd.nist.gov/vuln/detail/${esc(d.id)}">NVD</a></p>`);
      if (d.warnings.length) {
        lines.push('  ⚠ 자동 검사 경고:', ...d.warnings.map((w) => `    - ${w}`));
        html.push(`<p style="color:#b42318"><b>⚠ 자동 검사 경고</b></p><ul>${d.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`);
      }
      lines.push('  검토 메모(모델 작성):', ...d.reviewNotes.split('\n').map((l) => `    ${l}`), '');
      html.push(`<p><b>검토 메모(모델 작성)</b></p><pre style="white-space:pre-wrap">${esc(d.reviewNotes)}</pre>`);
    }
    const how = [
      '검토 방법:',
      '1. 초안을 읽고 공식 출처와 대조해 사실관계를 고친다.',
      '2. 공개해도 되면 프런트매터의 status: needs_review 를 status: published 로 바꾼다.',
      '3. PR 을 머지하면 사이트가 자동으로 다시 배포된다. 공개하지 않을 글은 파일을 지우거나 PR 을 닫는다.',
    ];
    lines.push(...how);
    html.push(`<p>${how.map(esc).join('<br>')}</p>`);
  }
  if (result.errors.length) {
    lines.push('', '처리 중 오류:', ...result.errors.map((e) => `- ${e.id}: ${e.error}`));
    html.push(`<p><b>처리 중 오류</b></p><ul>${result.errors.map((e) => `<li>${esc(e.id)}: ${esc(e.error)}</li>`).join('')}</ul>`);
  }

  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: Number(SMTP_PORT || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transport.sendMail({
    from: SMTP_FROM || `flaw2shell pipeline <${SMTP_USER}>`,
    to: config.reviewEmail,
    subject,
    text: lines.join('\n'),
    html: html.join('\n'),
  });
  console.log(`[notify] 검토 요청 메일 발송 완료 (${n}건)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync(OUTPUT)) {
    console.log('[notify] pipeline-output.json 없음 — 생략');
  } else {
    await sendReviewMail(JSON.parse(readFileSync(OUTPUT, 'utf8')), process.argv[2] || '');
  }
}
