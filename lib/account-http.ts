import {SESSION_COOKIE, SESSION_SECONDS, TOKEN_PATTERN} from './accounts.ts';

export const privateHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  // Suppress token paths without turning native POST-form Origin into "null".
  'Referrer-Policy': 'strict-origin',
  'X-Robots-Tag': 'noindex, nofollow',
};
export function sameOrigin(request: Request, base: string) {
  return request.headers.get('origin') === base && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export function readSession(request: Request) {
  const value = request.headers.get('cookie')?.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1);
  return value && TOKEN_PATTERN.test(value) ? value : undefined;
}
export function sessionCookie(token: string, base: string, clear = false) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : SESSION_SECONDS}${base.startsWith('https:') ? '; Secure' : ''}`;
}
export function accountRedirect(base: string, path: string, cookie?: string) {
  return new Response(null, {status: 303, headers: {...privateHeaders, Location: base + path, ...(cookie ? {'Set-Cookie': cookie} : {})}});
}
export function accountJson(body: unknown, status = 200) { return Response.json(body, {status, headers: privateHeaders}); }
export async function smallForm(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') throw new Error('Unsupported form.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing form.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16_384) { await reader.cancel(); throw new Error('Form too large.'); }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return new URLSearchParams(new TextDecoder().decode(result));
}
