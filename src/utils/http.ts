export interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  data: string;
  corsAllowed: boolean;
  contentType: string | null;
  error?: string;
  durationMs: number;
}

export async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 8000,
  fetchFn: typeof fetch = fetch
): Promise<SafeFetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const res = await fetchFn(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'stellar-anchor-doctor/1.0.0',
        Accept: '*/*',
        ...(options.headers || {}),
      },
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    const data = await res.text();
    const acao = res.headers.get('access-control-allow-origin');
    const corsAllowed = acao === '*' || acao === 'null' || acao !== null;
    const contentType = res.headers.get('content-type');

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data,
      corsAllowed,
      contentType,
      durationMs,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      headers: new Headers(),
      data: '',
      corsAllowed: false,
      contentType: null,
      error: err.name === 'AbortError' ? `Request timed out after ${timeoutMs}ms` : err.message,
      durationMs,
    };
  }
}

export function normalizeDomain(input: string): string {
  let domain = input.trim();
  if (domain.startsWith('https://')) {
    domain = domain.slice(8);
  } else if (domain.startsWith('http://')) {
    domain = domain.slice(7);
  }
  // Strip trailing slashes and paths
  domain = domain.split('/')[0];
  return domain;
}
