export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = 'ApiError'; this.status = status; }
}

/** Only public endpoints are called here. Server configuration never enters client responses. */
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const base = typeof window === 'undefined' ? (process.env.API_INTERNAL_URL || 'http://localhost:4000') : '';
  let response: Response;
  try {
    response = await fetch(`${base}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST', cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new ApiError(0, body === undefined ? 'We could not reach the showroom. Please try again shortly.' : 'We could not verify whether your request arrived. Please check before submitting again to avoid a duplicate.');
  }
  if (!response.ok) {
    const message = response.status === 429 ? 'Too many requests. Please wait a few minutes before trying again.'
      : response.status === 404 ? 'This item is no longer available.'
      : response.status === 422 ? 'Please check your details. A selected item or date may no longer be available.'
      : body === undefined ? 'This information is temporarily unavailable. Please try again shortly.'
      : 'Your request could not be verified. Please check before submitting again.';
    throw new ApiError(response.status, message);
  }
  try { return await response.json() as T; }
  catch { throw new ApiError(0, 'The showroom returned an unreadable response. Please check before trying again.'); }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };
export async function attempt<T>(request: Promise<T>): Promise<Result<T>> {
  try { return { ok: true, value: await request }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Information is temporarily unavailable.', status: error instanceof ApiError ? error.status : 0 }; }
}
