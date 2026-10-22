/**
 * §7 책임있는 설계 — 무기화 가능 패턴 목록.
 * 개념 설명에는 필요 없고 "복붙하면 바로 동작"하는 형태의 페이로드를 잡아낸다.
 * remark-safety(빌드 중 렌더 차단)와 scripts/verify-build.mjs(빌드 후 dist 검사)가 공유한다.
 */
export const WEAPONIZED_PATTERNS = [
  { name: 'reverse-shell:/dev/tcp', re: /\/dev\/(tcp|udp)\/[^\s/]+\/\d+/i },
  { name: 'reverse-shell:bash -i', re: /\b(ba)?sh\s+-i\b[^\n]*[>&]/i },
  { name: 'reverse-shell:nc -e', re: /\b(nc|ncat|netcat)\b[^\n]*\s-(e|c)\s/i },
  { name: 'reverse-shell:mkfifo', re: /\bmkfifo\b[^\n]*\|\s*(nc|ncat|sh|bash)/i },
  { name: 'reverse-shell:python pty', re: /pty\.spawn\(\s*["']\/bin\/(ba)?sh/i },
  { name: 'reverse-shell:socket+dup2', re: /socket\.socket\([^\n]*\n?[^\n]*(dup2|connect\(\(["'])/i },
  { name: 'powershell:encoded', re: /powershell(\.exe)?\b[^\n]*\s-(e|en|enc|encodedcommand)\s+[A-Za-z0-9+/=]{20,}/i },
  { name: 'powershell:tcpclient', re: /Net\.Sockets\.TCPClient/i },
  { name: 'powershell:iex download', re: /\bIEX\s*\(\s*\(?\s*New-Object\s+Net\.WebClient/i },
  { name: 'payload-generator', re: /\bmsfvenom\b|\bmsfconsole\b[^\n]*-x/i },
  { name: 'download-and-exec', re: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(ba)?sh\b/i },
  { name: 'shellcode-bytes', re: /(\\x[0-9a-f]{2}){24,}/i },
];

export function findWeaponized(text) {
  if (!text) return [];
  return WEAPONIZED_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}
