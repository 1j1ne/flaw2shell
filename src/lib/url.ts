/** base 경로(GitHub Pages 하위 경로 배포 등)를 고려한 내부 링크 */
const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
export const url = (p = '') => BASE + p.replace(/^\//, '');
export const BASE_URL = BASE;
