/**
 * UI 문자열 i18n. 정적 사이트이므로 두 언어를 모두 HTML에 넣고(<T> 컴포넌트),
 * <html data-lang> 값에 따라 CSS로 전환한다 → JS 없이도 깨지지 않고, 전환 시 깜빡임이 없다.
 */
export type Lang = 'ko' | 'en';
export type Str = { ko: string; en: string };

export const UI = {
  'site.tagline': { ko: '패치 한 줄이 왜 RCE를 막는가', en: 'Why one patched line stops an RCE' },
  'site.desc': {
    ko: '공개된 CVE를 골라 결함의 원리와 익스플로잇 흐름을 개념 중심으로 해설하는 보안 학습 사이트',
    en: 'Curated, concept-first explanations of public CVEs: what the flaw is and how exploitation works',
  },
  'nav.home': { ko: '최신', en: 'Latest' },
  'nav.classes': { ko: '취약점 클래스', en: 'Classes' },
  'nav.quiz': { ko: '퀴즈', en: 'Quiz' },
  'nav.ai': { ko: 'AI 보안', en: 'AI Security' },
  'nav.about': { ko: '소개', en: 'About' },
  'nav.skip': { ko: '본문으로 건너뛰기', en: 'Skip to content' },
  'theme.toggle': { ko: '테마 전환', en: 'Toggle theme' },
  'lang.toggle': { ko: 'English', en: '한국어' },
  'search.label': { ko: '검색', en: 'Search' },
  'search.placeholder': { ko: 'CVE ID, CWE, 키워드 검색…  ( / )', en: 'Search CVE ID, CWE, keyword…  ( / )' },
  'search.none': { ko: '일치하는 글이 없습니다.', en: 'No matching posts.' },
  'search.count': { ko: '건', en: 'posts' },
  'filter.difficulty': { ko: '난이도', en: 'Difficulty' },
  'filter.severity': { ko: '심각도', en: 'Severity' },
  'filter.all': { ko: '전체', en: 'All' },
  'diff.intro': { ko: '입문', en: 'Intro' },
  'diff.intermediate': { ko: '중급', en: 'Intermediate' },
  'diff.advanced': { ko: '고급', en: 'Advanced' },
  'diff.inferred': { ko: 'CWE 기반 추정', en: 'inferred from CWE' },
  'home.latest': { ko: '최신 포스트', en: 'Latest posts' },
  'home.empty': { ko: '아직 게시된 글이 없습니다.', en: 'No published posts yet.' },
  'post.toc': { ko: '목차', en: 'Contents' },
  'post.read': { ko: '해설 읽기', en: 'Read' },
  'post.generated': { ko: '파이프라인 생성 · 사람 검토 후 게시', en: 'Pipeline-generated · human-reviewed' },
  'post.related': { ko: '같은 클래스의 다른 글', en: 'More in this class' },
  'post.noTranslation': {
    ko: '이 글은 아직 한국어 원문만 있습니다.',
    en: 'No English translation yet — showing the Korean original.',
  },
  'post.sample': {
    ko: '렌더링 시연용 샘플 — 본문의 기술 세부(코드·diff·흐름)는 사이트 기능을 보여주기 위한 예시이며 실제 어드바이저리와 다를 수 있습니다. 사실관계는 반드시 공식 참조로 확인하세요.',
    en: 'Rendering sample — technical details (code, diff, flow) are illustrative and may differ from the actual advisory. Always verify against the official references.',
  },
  'post.officialRefs': { ko: '공식 참조', en: 'Official references' },
  'post.quizCta': { ko: '이 글로 퀴즈 풀기', en: 'Quiz on this post' },
  'post.missing': { ko: '본문에 없는 섹션', en: 'Missing section' },
  'disclaimer.title': { ko: '방어·교육 목적', en: 'For defense & education' },
  'disclaimer.body': {
    ko: '이 글은 결함의 원리를 이해하고 탐지·패치하기 위한 해설입니다. 무기화된 익스플로잇은 싣지 않으며, 재현은 인터넷과 분리된 로컬 Docker 랩에서 본인이 소유한 시스템으로만 하세요. 권한 없는 시스템에 대한 시도는 불법입니다.',
    en: 'This write-up explains the flaw so you can understand, detect and patch it. No weaponized exploits are included. Reproduce only in an isolated local Docker lab on systems you own. Testing systems without authorization is illegal.',
  },
  'footer.disclosure': {
    ko: '책임있는 공개 원칙을 따르며, 모든 글은 공식 어드바이저리와 패치로 연결합니다. 무기화된 PoC·리버스쉘은 게시하지 않습니다.',
    en: 'We follow responsible disclosure and always link to official advisories and patches. No weaponized PoCs or reverse shells.',
  },
  'footer.news': {
    ko: '뉴스·블로그 원문은 요약과 링크로만 소개합니다.',
    en: 'News and blog sources are summarized and linked, never republished.',
  },
  'classes.title': { ko: '취약점 클래스', en: 'Vulnerability classes' },
  'classes.lead': {
    ko: '연대순이 아니라 결함의 "모양"으로 묶어 봅니다. 같은 클래스의 글을 연달아 읽으면 근본 원인과 패치의 패턴이 보입니다.',
    en: 'Browse by the shape of the flaw rather than by date. Reading one class in a row reveals recurring root causes and fixes.',
  },
  'classes.posts': { ko: '편', en: 'posts' },
  'classes.noPosts': { ko: '아직 이 클래스의 글이 없습니다. 아래 패턴 요약으로 먼저 학습하세요.', en: 'No posts in this class yet. Start with the pattern summary below.' },
  'class.pattern': { ko: '근본 원인 패턴', en: 'Root-cause pattern' },
  'class.fix': { ko: '전형적인 패치', en: 'Typical fix' },
  'class.mitre': { ko: 'MITRE CWE 정의', en: 'MITRE CWE definition' },
  'quiz.title': { ko: '퀴즈 & 플래시카드', en: 'Quiz & flashcards' },
  'quiz.lead': {
    ko: '게시된 글에서 자동 생성한 문제입니다. 자격증(Security+, 모의해킹) · CTF 대비 반복 학습용.',
    en: 'Generated from published posts. For cert (Security+, pentest) and CTF review.',
  },
  'quiz.mode.quiz': { ko: '객관식', en: 'Multiple choice' },
  'quiz.mode.cards': { ko: '플래시카드', en: 'Flashcards' },
  'quiz.check': { ko: '정답 확인', en: 'Check' },
  'quiz.next': { ko: '다음 문제', en: 'Next' },
  'quiz.correct': { ko: '정답', en: 'Correct' },
  'quiz.wrong': { ko: '오답', en: 'Incorrect' },
  'quiz.score': { ko: '점수', en: 'Score' },
  'quiz.restart': { ko: '처음부터', en: 'Restart' },
  'quiz.retryWrong': { ko: '틀린 문제만', en: 'Retry missed' },
  'quiz.flip': { ko: '뒤집기', en: 'Flip' },
  'quiz.source': { ko: '출처 글', en: 'Source' },
  'quiz.done': { ko: '모든 문제를 풀었습니다.', en: 'All questions answered.' },
  'ai.title': { ko: 'AI 보안 트랙', en: 'AI security track' },
  'ai.lead': {
    ko: 'LLM·ML 시스템의 취약점을 따로 모았습니다. 새로운 공격면이지만, 대부분은 "신뢰 경계가 어디인가"라는 오래된 질문으로 귀결됩니다.',
    en: 'Vulnerabilities in LLM/ML systems. A new attack surface, but most cases come back to an old question: where is the trust boundary?',
  },
  'ai.primers': { ko: '핵심 개념', en: 'Core concepts' },
  'ai.posts': { ko: '트랙 포스트', en: 'Track posts' },
  'ai.empty': {
    ko: '아직 AI 트랙에 게시된 글이 없습니다. 파이프라인이 track: ai 또는 AI 계열 CWE 글을 게시하면 여기에 표시됩니다.',
    en: 'No AI-track posts yet. Posts with track: ai or an AI-family CWE will appear here.',
  },
} satisfies Record<string, Str>;

export type UIKey = keyof typeof UI;
export const t = (k: UIKey, lang: Lang = 'ko') => UI[k][lang];
