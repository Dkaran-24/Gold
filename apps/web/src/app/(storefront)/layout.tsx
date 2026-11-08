import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { categories, collections } from '@/lib/server-api';

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [categoryResult, collectionResult] = await Promise.all([categories(), collections(1, 8)]);
  const categoryLinks = categoryResult.ok ? categoryResult.value.filter(c => c.visible !== false).map(c => ({ href: `/products?categoryId=${c.id}`, label: c.name })) : [];
  const collectionLinks = collectionResult.ok ? collectionResult.value.data.map(c => ({ href: `/collections/${c.slug}`, label: c.name })) : [];
  return <><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader categories={categoryLinks} collections={collectionLinks} /><main id="main-content">{children}</main><SiteFooter /></>;
}
