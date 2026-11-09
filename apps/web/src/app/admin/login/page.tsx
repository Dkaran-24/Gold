import { redirect } from 'next/navigation';
import { optionalOwnerSession } from '@/lib/admin/session';
import { Login } from '@/components/admin/login';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const sp = await searchParams;
  if (sp.expired !== '1') {
    const session = await optionalOwnerSession();
    if (session) {
      redirect('/admin');
    }
  }
  return <Login expired={sp.expired === '1'} />;
}
