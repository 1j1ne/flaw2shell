/**
 * 취약점 클래스(CWE) 카탈로그 — /classes, /class/[cwe], 퀴즈 오답 보기, 난이도 추정에 사용.
 * 포스트의 cwe 가 여기 없어도 동작한다(포스트의 cwe_label 로 대체).
 */
export type Family = 'memory' | 'injection' | 'web' | 'auth' | 'logic' | 'crypto' | 'ai';
export type Difficulty = 'intro' | 'intermediate' | 'advanced';
type L = { ko: string; en: string };

export interface CweInfo {
  id: string;
  name: L;
  family: Family;
  difficulty: Difficulty;
  /** 한 줄 정의 */
  desc: L;
  /** 패턴 학습: 근본 원인이 보통 어떤 모양인가 */
  pattern: L;
  /** 패턴 학습: 패치는 보통 어떤 모양인가 */
  fix: L;
}

export const FAMILIES: Record<Family, L> = {
  memory: { ko: '메모리 안전성', en: 'Memory safety' },
  injection: { ko: '인젝션 · 역직렬화', en: 'Injection & deserialization' },
  web: { ko: '웹 애플리케이션', en: 'Web application' },
  auth: { ko: '인증 · 인가', en: 'Authentication & authorization' },
  logic: { ko: '로직 · 동시성 · 정보노출', en: 'Logic, concurrency & exposure' },
  crypto: { ko: '암호', en: 'Cryptography' },
  ai: { ko: 'AI / LLM', en: 'AI / LLM' },
};

const c = (
  id: string, ko: string, en: string, family: Family, difficulty: Difficulty,
  desc: L, pattern: L, fix: L,
): CweInfo => ({ id, name: { ko, en }, family, difficulty, desc, pattern, fix });

export const CWE_CATALOG: CweInfo[] = [
  c('CWE-416', 'Use-After-Free', 'Use-After-Free', 'memory', 'advanced',
    { ko: '해제된 메모리를 가리키는 포인터(dangling pointer)를 계속 사용하는 결함.', en: 'Memory is used through a pointer after it has been freed.' },
    { ko: '소유권/수명 추적 실패: 한 경로에서 객체를 해제했는데 다른 경로가 같은 객체에 대한 참조를 들고 있다. 해제된 슬롯이 공격자 제어 데이터로 재할당되면 오래된 포인터가 그 데이터를 "객체"로 해석한다.', en: 'Lifetime tracking fails: one path frees an object while another still holds a reference. If the freed slot is reallocated with attacker data, the stale pointer interprets it as an object.' },
    { ko: '참조 카운트 증가/감소 순서 교정, 해제 후 포인터 무효화(NULL 대입), 해제를 사용 이후로 지연.', en: 'Fix refcount ordering, null out pointers after free, or defer the free until after the last use.' }),
  c('CWE-415', 'Double Free', 'Double Free', 'memory', 'advanced',
    { ko: '같은 메모리를 두 번 해제하는 결함.', en: 'The same memory is freed twice.' },
    { ko: '에러 처리 경로와 정상 경로가 각각 해제를 수행하거나, 소유권이 두 곳에 있다고 착각한다. 할당자 메타데이터가 오염되어 이후 할당이 겹칠 수 있다.', en: 'Error and normal paths both free, or two owners believe they own the buffer. Allocator metadata gets corrupted so later allocations can overlap.' },
    { ko: '단일 소유자 원칙, 해제 직후 NULL 대입, goto cleanup 패턴 정리.', en: 'Single owner, null after free, consolidate cleanup paths.' }),
  c('CWE-787', '경계 밖 쓰기', 'Out-of-bounds Write', 'memory', 'advanced',
    { ko: '버퍼 경계를 넘어 데이터를 쓰는 결함(스택/힙 오버플로 포함).', en: 'Data is written past the end (or before the start) of a buffer.' },
    { ko: '길이 계산과 실제 복사량이 어긋난다: 신뢰할 수 없는 길이 필드, off-by-one, 정수 오버플로로 작아진 할당 크기.', en: 'The computed length and the copied length disagree: untrusted length fields, off-by-one, or an allocation shrunk by integer overflow.' },
    { ko: '복사 전 경계 검사 추가, 크기 계산에 오버플로 검사, 안전한 API 사용.', en: 'Add bounds checks before copying, overflow-checked size math, safer APIs.' }),
  c('CWE-125', '경계 밖 읽기', 'Out-of-bounds Read', 'memory', 'intermediate',
    { ko: '버퍼 경계를 넘어 데이터를 읽는 결함. 정보 노출이나 크래시로 이어진다.', en: 'Data is read outside buffer bounds, leading to info leaks or crashes.' },
    { ko: '파서가 입력에 적힌 길이를 믿고 읽는다. 메모리 레이아웃 노출로 ASLR 우회의 재료가 되기도 한다.', en: 'A parser trusts a length from the input. Leaked memory often helps bypass ASLR.' },
    { ko: '남은 입력 길이와 선언된 길이를 비교하는 검사 추가.', en: 'Compare the declared length with the remaining input length.' }),
  c('CWE-190', '정수 오버플로', 'Integer Overflow or Wraparound', 'memory', 'advanced',
    { ko: '정수 연산 결과가 표현 범위를 넘어 감싸지는(wrap) 결함.', en: 'An integer calculation wraps around its representable range.' },
    { ko: '크기 = 개수 × 원소크기 계산이 감싸져 작은 버퍼가 할당되고, 이후 원래 개수만큼 쓰면서 경계 밖 쓰기로 이어진다.', en: 'size = count * elem wraps, a small buffer is allocated, then the original count is written → OOB write.' },
    { ko: '오버플로 검사 내장 함수(__builtin_mul_overflow 등), 상한 검증.', en: 'Overflow-checked builtins, explicit upper bounds.' }),
  c('CWE-476', 'NULL 포인터 역참조', 'NULL Pointer Dereference', 'memory', 'intermediate',
    { ko: 'NULL 일 수 있는 포인터를 검사 없이 역참조하는 결함. 주로 DoS.', en: 'A possibly-NULL pointer is dereferenced without a check; usually DoS.' },
    { ko: '할당/조회 실패 경로를 처리하지 않는다.', en: 'Failure paths of allocation/lookup are not handled.' },
    { ko: '반환값 검사와 조기 반환.', en: 'Check return values and bail out early.' }),
  c('CWE-843', '타입 혼동', 'Type Confusion', 'memory', 'advanced',
    { ko: '객체를 실제와 다른 타입으로 해석해 접근하는 결함.', en: 'A resource is accessed as an incompatible type.' },
    { ko: 'JIT/인터프리터가 타입 가정을 캐시해 두고, 타입이 바뀐 뒤에도 그 가정으로 필드 오프셋에 접근한다.', en: 'A JIT/interpreter caches a type assumption and keeps using field offsets after the type changed.' },
    { ko: '타입 태그 재검증, 최적화 가정 무효화(deopt) 조건 보강.', en: 'Re-check type tags; strengthen deoptimization conditions.' }),
  c('CWE-362', '경쟁 상태', 'Race Condition', 'logic', 'advanced',
    { ko: '공유 자원에 대한 동기화가 부족해 실행 순서에 따라 결과가 달라지는 결함(TOCTOU 포함).', en: 'Insufficient synchronization on a shared resource; outcome depends on timing (incl. TOCTOU).' },
    { ko: '검사와 사용 사이에 다른 스레드/프로세스가 상태를 바꿀 수 있는 창(window)이 있다.', en: 'A window exists between check and use where another actor can change state.' },
    { ko: '락 범위 확장, 원자적 연산, 검사-사용 결합(openat/O_NOFOLLOW 등).', en: 'Widen locks, use atomics, make check-and-use atomic.' }),
  c('CWE-79', '크로스 사이트 스크립팅(XSS)', 'Cross-site Scripting (XSS)', 'web', 'intro',
    { ko: '사용자 입력이 이스케이프 없이 HTML/JS 문맥에 들어가 스크립트로 실행되는 결함.', en: 'User input reaches an HTML/JS context without proper encoding and executes as script.' },
    { ko: '출력 문맥(HTML 본문/속성/URL/JS)에 맞지 않는 인코딩, 또는 innerHTML 같은 위험 싱크.', en: 'Encoding that does not match the output context, or dangerous sinks like innerHTML.' },
    { ko: '문맥별 출력 인코딩, 템플릿 자동 이스케이프, CSP.', en: 'Context-aware output encoding, auto-escaping templates, CSP.' }),
  c('CWE-89', 'SQL 인젝션', 'SQL Injection', 'injection', 'intro',
    { ko: '입력이 SQL 문법의 일부로 해석되는 결함.', en: 'Input is interpreted as part of SQL syntax.' },
    { ko: '문자열 연결로 쿼리를 만든다. 데이터와 코드(쿼리 구조)의 경계가 없다.', en: 'Queries built by string concatenation; no boundary between data and code.' },
    { ko: '파라미터 바인딩(Prepared Statement), ORM 안전 API, 최소 권한 DB 계정.', en: 'Parameterized queries, safe ORM APIs, least-privilege DB accounts.' }),
  c('CWE-78', 'OS 명령 인젝션', 'OS Command Injection', 'injection', 'intro',
    { ko: '입력이 셸 명령의 일부로 해석되어 임의 명령이 실행되는 결함.', en: 'Input becomes part of a shell command, allowing arbitrary commands.' },
    { ko: '셸을 거치는 실행 API에 입력을 이어붙인다. 셸 메타문자가 명령 경계를 바꾼다.', en: 'Input is concatenated into a shell-invoking API; metacharacters change command boundaries.' },
    { ko: '셸 없이 인자 배열로 실행, 허용목록 검증.', en: 'Execute without a shell using argument arrays; allowlist validation.' }),
  c('CWE-94', '코드 인젝션', 'Code Injection', 'injection', 'intermediate',
    { ko: '입력이 인터프리터 코드로 평가되는 결함(eval, 템플릿 인젝션 등).', en: 'Input is evaluated as code (eval, template injection, etc.).' },
    { ko: '동적 평가 기능에 신뢰할 수 없는 문자열이 도달한다.', en: 'Untrusted strings reach dynamic evaluation.' },
    { ko: '동적 평가 제거, 샌드박스 템플릿, 데이터와 코드 분리.', en: 'Remove dynamic eval, sandboxed templates, separate data from code.' }),
  c('CWE-22', '경로 조작', 'Path Traversal', 'web', 'intro',
    { ko: '../ 등으로 의도된 디렉터리 밖 파일에 접근하는 결함.', en: 'Files outside the intended directory are reached via ../ and similar.' },
    { ko: '정규화 전에 검사하거나, 사용자 입력을 경로에 그대로 결합한다.', en: 'Checks happen before canonicalization, or input is joined into paths directly.' },
    { ko: '정규화 후 기준 디렉터리 접두어 검사, 파일 ID 매핑.', en: 'Canonicalize then verify base-dir prefix; map IDs to files.' }),
  c('CWE-918', '서버 측 요청 위조(SSRF)', 'Server-Side Request Forgery', 'web', 'intermediate',
    { ko: '서버가 공격자가 지정한 URL로 요청을 보내도록 유도되는 결함.', en: 'The server is induced to make requests to attacker-chosen URLs.' },
    { ko: 'URL 검증과 실제 요청 대상 해석이 다르다(리다이렉트, DNS 재바인딩, 파서 차이).', en: 'URL validation differs from the actual resolved target (redirects, DNS rebinding, parser differentials).' },
    { ko: '해석된 IP 기준 허용목록, 리다이렉트 제한, 메타데이터 엔드포인트 차단.', en: 'Allowlist on resolved IPs, restrict redirects, block metadata endpoints.' }),
  c('CWE-352', '크로스 사이트 요청 위조(CSRF)', 'Cross-Site Request Forgery', 'web', 'intro',
    { ko: '피해자의 브라우저가 의도하지 않은 상태 변경 요청을 보내게 되는 결함.', en: "A victim's browser is made to send unintended state-changing requests." },
    { ko: '쿠키 인증만으로 상태 변경을 허용하고 요청 출처를 확인하지 않는다.', en: 'State changes rely on cookies alone without verifying request origin.' },
    { ko: 'CSRF 토큰, SameSite 쿠키, Origin 검증.', en: 'CSRF tokens, SameSite cookies, Origin checks.' }),
  c('CWE-611', 'XML 외부 엔티티(XXE)', 'XML External Entity', 'web', 'intermediate',
    { ko: 'XML 파서가 외부 엔티티를 해석해 파일 읽기/SSRF가 가능한 결함.', en: 'An XML parser resolves external entities, enabling file reads or SSRF.' },
    { ko: '기본 설정이 외부 엔티티/DTD를 허용한다.', en: 'Parser defaults allow external entities / DTDs.' },
    { ko: 'DTD·외부 엔티티 비활성화.', en: 'Disable DTDs and external entities.' }),
  c('CWE-502', '신뢰할 수 없는 데이터 역직렬화', 'Deserialization of Untrusted Data', 'injection', 'intermediate',
    { ko: '신뢰할 수 없는 바이트열을 객체로 복원하면서 의도치 않은 코드 경로가 실행되는 결함.', en: 'Restoring objects from untrusted bytes triggers unintended code paths.' },
    { ko: '역직렬화 포맷이 타입/생성자 호출을 표현할 수 있어, 복원 과정 자체가 "가젯" 실행이 된다. ML 모델 파일(pickle 기반)도 같은 원리.', en: 'The format can express types/constructor calls, so restoring runs "gadgets". Pickle-based ML model files share this.' },
    { ko: '데이터 전용 포맷(JSON, safetensors), 타입 허용목록, 서명 검증.', en: 'Data-only formats (JSON, safetensors), type allowlists, signature checks.' }),
  c('CWE-434', '위험한 파일 업로드', 'Unrestricted File Upload', 'web', 'intro',
    { ko: '실행 가능한 파일 형식의 업로드를 허용하는 결함.', en: 'Dangerous file types can be uploaded and executed.' },
    { ko: '확장자/Content-Type만 보고 판단하거나, 업로드 경로가 실행 가능한 웹 루트 안에 있다.', en: 'Decisions based on extension/Content-Type only, or uploads stored in an executable web root.' },
    { ko: '웹 루트 밖 저장, 이름 재생성, 내용 기반 검증.', en: 'Store outside web root, regenerate names, content-based validation.' }),
  c('CWE-287', '부적절한 인증', 'Improper Authentication', 'auth', 'intermediate',
    { ko: '주장된 신원을 충분히 검증하지 않는 결함.', en: 'A claimed identity is not sufficiently verified.' },
    { ko: '토큰 서명 미검증, 대체 경로(alternate path)로 인증 우회, 상태 머신 누락.', en: 'Unverified token signatures, alternate paths that skip auth, missing state checks.' },
    { ko: '중앙 인증 미들웨어, 서명·만료 검증, 모든 경로에 일관 적용.', en: 'Central auth middleware; verify signature and expiry on every path.' }),
  c('CWE-862', '인가 누락', 'Missing Authorization', 'auth', 'intro',
    { ko: '행위 수행 전 권한을 확인하지 않는 결함(IDOR 포함).', en: 'No authorization check before an action (incl. IDOR).' },
    { ko: '인증은 했지만 "이 사용자가 이 객체에 접근해도 되는가"를 묻지 않는다.', en: 'Authenticated, but never asks "may this user access this object?"' },
    { ko: '객체 단위 권한 검사, 기본 거부(default deny).', en: 'Per-object authorization checks; default deny.' }),
  c('CWE-863', '부정확한 인가', 'Incorrect Authorization', 'auth', 'intermediate',
    { ko: '권한 검사는 있지만 로직이 틀린 결함.', en: 'An authorization check exists but is wrong.' },
    { ko: '역할 비교 오류, 클라이언트 제공 값 신뢰, 경로 정규화 차이로 우회.', en: 'Wrong role comparisons, trusting client values, bypass via path normalization differences.' },
    { ko: '서버 측 권한 모델 단일화, 정규화 후 검사.', en: 'Single server-side policy model; check after normalization.' }),
  c('CWE-306', '중요 기능 인증 누락', 'Missing Authentication for Critical Function', 'auth', 'intro',
    { ko: '관리/중요 기능에 인증 자체가 없는 결함.', en: 'A critical function requires no authentication at all.' },
    { ko: '내부망 전용이라 가정한 관리 API가 외부에 노출된다.', en: 'Admin APIs assumed to be internal-only get exposed.' },
    { ko: '모든 관리 엔드포인트에 인증, 네트워크 분리.', en: 'Authenticate every admin endpoint; segment the network.' }),
  c('CWE-798', '하드코딩된 자격증명', 'Use of Hard-coded Credentials', 'auth', 'intro',
    { ko: '소스/펌웨어에 비밀번호·키가 박혀 있는 결함.', en: 'Passwords or keys are embedded in source or firmware.' },
    { ko: '모든 설치본이 같은 비밀을 공유하므로 하나가 유출되면 전체가 뚫린다.', en: 'Every installation shares the same secret; one leak compromises all.' },
    { ko: '설치 시 고유 비밀 생성, 비밀 관리 시스템.', en: 'Per-install secrets, secret management.' }),
  c('CWE-200', '민감 정보 노출', 'Exposure of Sensitive Information', 'logic', 'intro',
    { ko: '권한 없는 주체에게 민감 정보가 노출되는 결함.', en: 'Sensitive information is exposed to an unauthorized actor.' },
    { ko: '상세 에러 메시지, 디버그 엔드포인트, 과도한 API 응답 필드.', en: 'Verbose errors, debug endpoints, over-broad API responses.' },
    { ko: '응답 필드 허용목록, 운영 환경 디버그 비활성화.', en: 'Allowlist response fields; disable debug in production.' }),
  c('CWE-327', '취약한 암호 알고리즘', 'Broken or Risky Cryptographic Algorithm', 'crypto', 'intermediate',
    { ko: '깨졌거나 위험한 암호 알고리즘/모드를 사용하는 결함.', en: 'A broken or risky cryptographic algorithm or mode is used.' },
    { ko: 'MD5/SHA-1 서명, ECB 모드, 고정 IV 등.', en: 'MD5/SHA-1 signatures, ECB mode, static IVs.' },
    { ko: '검증된 라이브러리의 현대적 AEAD 사용.', en: 'Use modern AEAD from vetted libraries.' }),
  c('CWE-1321', '프로토타입 오염', 'Prototype Pollution', 'web', 'intermediate',
    { ko: 'JS 객체 병합 시 __proto__ 등을 통해 공용 프로토타입을 수정하는 결함.', en: 'Object merging modifies a shared prototype via __proto__ and similar keys.' },
    { ko: '재귀 병합/경로 설정 함수가 특수 키를 걸러내지 않는다.', en: 'Recursive merge / path-set helpers do not filter special keys.' },
    { ko: '특수 키 차단, Object.create(null), Map 사용.', en: 'Block special keys, use Object.create(null) or Map.' }),
  c('CWE-1427', 'LLM 프롬프트 입력 미중화(프롬프트 인젝션)', 'Improper Neutralization of Input Used for LLM Prompting', 'ai', 'intermediate',
    { ko: '외부 입력이 LLM 지시문과 구분되지 않아 모델 동작을 바꾸는 결함(직접/간접 프롬프트 인젝션).', en: 'External input is not separated from instructions, letting it steer the model (direct/indirect prompt injection).' },
    { ko: '시스템 지시, 사용자 입력, 검색/도구로 가져온 문서가 하나의 텍스트 채널에 섞인다. 모델은 "데이터"와 "명령"을 구조적으로 구분하지 못한다.', en: 'System instructions, user input and retrieved documents share one text channel; the model cannot structurally separate data from commands.' },
    { ko: '도구 권한 최소화, 민감 행위 사람 확인, 출력 검증 — 입력 필터만으로는 불충분.', en: 'Least-privilege tools, human confirmation for sensitive actions, output validation — input filtering alone is insufficient.' }),
  c('CWE-1426', '생성형 AI 출력 검증 부족', 'Improper Validation of Generative AI Output', 'ai', 'intermediate',
    { ko: '모델 출력을 검증 없이 코드 실행/쿼리/HTML 렌더 등에 사용하는 결함.', en: 'Model output is used for execution, queries or rendering without validation.' },
    { ko: 'LLM 출력이 고전적 싱크(셸, SQL, innerHTML)로 흘러간다 — 결국 기존 인젝션 클래스의 새 입력원.', en: 'LLM output flows into classic sinks (shell, SQL, innerHTML) — a new source for old injection classes.' },
    { ko: '출력을 신뢰할 수 없는 입력으로 취급, 구조화 출력 스키마 검증, 샌드박스.', en: 'Treat output as untrusted input; schema-validate structured output; sandbox.' }),
  c('CWE-1039', '적대적 입력 섭동 처리 부족', 'Inadequate Detection or Handling of Adversarial Input Perturbations', 'ai', 'advanced',
    { ko: '자동 인식(ML) 메커니즘이 적대적으로 조작된 입력을 탐지·처리하지 못하는 결함.', en: 'An automated recognition (ML) mechanism fails to detect or handle adversarially perturbed inputs.' },
    { ko: '사람에게는 같아 보이는 미세한 변형이 모델 판단을 뒤집는다.', en: 'Perturbations imperceptible to humans flip the model decision.' },
    { ko: '적대적 학습, 입력 전처리, 다중 신호 교차 검증.', en: 'Adversarial training, input preprocessing, cross-checking with other signals.' }),
];

const byId = new Map(CWE_CATALOG.map((x) => [x.id, x]));
export const getCwe = (id: string) => byId.get(id);
export const AI_CWES = new Set(CWE_CATALOG.filter((x) => x.family === 'ai').map((x) => x.id));
export const cweNumber = (id: string) => Number(id.replace(/\D/g, '')) || 0;
