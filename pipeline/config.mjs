/**
 * 파이프라인 설정 — 모두 환경 변수로 덮어쓸 수 있다 (GitHub Actions: Settings → Secrets and variables).
 */
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  /** 최근 몇 시간 안에 공개된 CVE를 볼지 (매일 실행 기준 24 + 여유) */
  lookbackHours: num(process.env.F2S_LOOKBACK_HOURS, 26),
  /** 이 점수 이상만 후보 */
  minCvss: num(process.env.F2S_MIN_CVSS, 8.0),
  /** 한 번 실행에 만들 초안 최대 수 (API 비용 상한) */
  maxDrafts: num(process.env.F2S_MAX_DRAFTS, 3),
  /** 초안 작성 모델 */
  model: process.env.F2S_MODEL || 'claude-opus-5-5',
  /** 검토 요청 메일 받는 사람 (공개 저장소에 주소가 노출되지 않도록 Secret 으로 넣는다) */
  reviewEmail: process.env.REVIEW_EMAIL || '',
  nvdApiKey: process.env.NVD_API_KEY || '',
  /** true 면 Claude 호출 없이 후보 선별까지만 (테스트용) */
  dryRun: process.env.F2S_DRY_RUN === '1',
};
