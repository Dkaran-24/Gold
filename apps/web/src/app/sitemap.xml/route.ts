import { api } from '@/lib/api';
import { publicSitemap } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export function GET() {
  return publicSitemap(path => api(path));
}
