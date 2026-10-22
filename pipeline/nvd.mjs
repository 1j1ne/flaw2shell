/**
 * 1) 수집 — NVD CVE API 2.0 에서 최근 공개된 CVE 를 가져온다.
 *    https://nvd.nist.gov/developers/vulnerabilities
 * 2) 선별 — CVSS 기준, 이미 있는 글 제외, 점수·패치 링크 유무로 정렬.
 */
const API = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// NVD 형식: 2026-10-21T00:00:00.000+00:00
const nvdDate = (d) => d.toISOString().replace('Z', '+00:00');

export async function fetchRecentCves({ lookbackHours, apiKey }) {
  const end = new Date();
  const start = new Date(end.getTime() - lookbackHours * 3600_000);
  const out = [];
  let startIndex = 0;
  for (;;) {
    const params = new URLSearchParams({
      pubStartDate: nvdDate(start),
      pubEndDate: nvdDate(end),
      resultsPerPage: '2000',
      startIndex: String(startIndex),
      noRejected: '',
    });
    const res = await fetchWithRetry(`${API}?${params.toString().replace('noRejected=', 'noRejected')}`, apiKey);
    const data = await res.json();
    out.push(...(data.vulnerabilities ?? []).map((v) => v.cve));
    startIndex += data.resultsPerPage ?? 0;
    if (!data.resultsPerPage || startIndex >= data.totalResults) break;
    await sleep(apiKey ? 700 : 6500); // 키 없으면 30초에 5회 제한
  }
  return out;
}

async function fetchWithRetry(url, apiKey, tries = 4) {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: apiKey ? { apiKey } : {} });
    if (res.ok) return res;
    if (i >= tries - 1 || ![403, 429, 500, 502, 503, 504].includes(res.status))
      throw new Error(`NVD API ${res.status}: ${await res.text().catch(() => '')}`);
    await sleep(10_000 * (i + 1));
  }
}

/** NVD 레코드 → 사이트에 필요한 필드로 정규화 */
export function normalize(cve) {
  const m = cve.metrics ?? {};
  const all = [...(m.cvssMetricV31 ?? []), ...(m.cvssMetricV30 ?? []), ...(m.cvssMetricV40 ?? [])];
  // NVD 자체 평가(Primary)를 우선, 없으면 CNA(Secondary)
  const metric = all.find((x) => x.type === 'Primary') ?? all[0];
  const cvss = metric?.cvssData?.baseScore;
  const severity = metric?.cvssData?.baseSeverity;
  const cwes = (cve.weaknesses ?? [])
    .flatMap((w) => w.description ?? [])
    .map((d) => d.value)
    .filter((v) => /^CWE-\d+$/.test(v));
  const description = (cve.descriptions ?? []).find((d) => d.lang === 'en')?.value ?? '';
  const references = (cve.references ?? []).map((r) => ({ url: r.url, tags: r.tags ?? [] }));
  return {
    id: cve.id,
    published: cve.published,
    status: cve.vulnStatus,
    cvss: typeof cvss === 'number' ? cvss : null,
    vector: metric?.cvssData?.vectorString ?? '',
    severity: severity ? String(severity).toUpperCase() : null,
    cwes: [...new Set(cwes)],
    description,
    references,
    hasPatchRef: references.some((r) => r.tags.includes('Patch') || /\/commit\/[0-9a-f]{7,}/i.test(r.url)),
  };
}

export function select(cves, { minCvss, maxDrafts, existingIds }) {
  return cves
    .map(normalize)
    .filter((c) => c.cvss !== null && c.cvss >= minCvss)
    .filter((c) => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(c.severity))
    .filter((c) => c.description.length > 40 && !/^\*\* ?(REJECT|DISPUTED)/i.test(c.description))
    .filter((c) => !existingIds.has(c.id))
    .sort((a, b) => Number(b.hasPatchRef) - Number(a.hasPatchRef) || b.cvss - a.cvss)
    .slice(0, maxDrafts);
}
