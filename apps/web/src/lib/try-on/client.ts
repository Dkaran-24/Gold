export class TryOnError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function tryOnRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch('/api/try-on/' + path, {
    ...options, signal, cache: 'no-store', credentials: 'same-origin',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new TryOnError(response.status, body?.error?.message || 'The fitting room is temporarily unavailable. Please try again.');
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  return body.data as T;
}

export function safeResultUrl(value: unknown, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  if (typeof value !== 'string' || !value || !origin) return null;
  try {
    const url = new URL(value, origin);
    const resultPath = /^\/api\/try-on\/jobs\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/result$/i;
    if (url.origin !== origin || url.username || url.password || url.hash || !resultPath.test(url.pathname)) return null;
    const params = url.searchParams;
    if (params.size !== 2 || !/^\d+$/.test(params.get('until') || '') || !/^[a-f0-9]{64}$/.test(params.get('signature') || '')) return null;
    return url.href;
  } catch {
    return null;
  }
}

