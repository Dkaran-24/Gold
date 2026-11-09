import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const ownerSession = cache(async () => {
  const token = (await cookies()).get('showroom_session')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) redirect('/admin/login');
  let response: Response;
  try { response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/auth/me`, { headers: { Cookie: `showroom_session=${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error('Owner authentication is temporarily unavailable. Please retry.'); }
  if (response.status === 401) redirect('/admin/login?expired=1');
  if (!response.ok) throw new Error('Owner authentication is unavailable. Please retry.');
  const result = await response.json();
  return result.data as { id: string; email: string; name: string };
});
export const optionalOwnerSession = cache(async () => {
  const token = (await cookies()).get('showroom_session')?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL || 'http://localhost:4000'}/api/auth/me`, {
      headers: { Cookie: `showroom_session=${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const result = await response.json();
    return result.data as { id: string; email: string; name: string };
  } catch {
    return null;
  }
});
