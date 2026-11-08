import { notFound } from 'next/navigation';
import { TryOnManagement } from '@/components/admin/try-on';
import { ownerSession } from '@/lib/admin/session';
import { Overview, SettingsPending } from '@/components/admin/overview';
import { CategoryEditor, CategoryList, ProductEditor, ProductList } from '@/components/admin/catalogue';
import { CollectionEditor, CollectionList } from '@/components/admin/collections';
import { CmsEditor, CmsHome, CmsPreview } from '@/components/admin/cms';
import { AvailabilityEditor, CrmDetail, CrmList } from '@/components/admin/crm';
export default async function AdminPage({ params, searchParams }: { params: Promise<{ path?: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  await ownerSession();
  const { path = [] } = await params;
  const sp = (await searchParams) || {};
  const [module, id = '', child = ''] = path;
  if (!path.length) return <Overview />;
  if (path.length === 1) {
    switch (module) {
      case 'products': return <ProductList key={`products-${sp.publication ?? ''}`} initialPublication={typeof sp.publication === 'string' ? sp.publication : ''} />;
      case 'inventory': return <ProductList inventory />;
      case 'categories': return <CategoryList />;
      case 'collections': return <CollectionList />;
      case 'homepage': return <CmsHome />;
      case 'enquiries': case 'appointments': return <CrmList key={`${module}-${sp.status ?? ''}-${sp.view ?? ''}-${sp.date ?? ''}`} kind={module} initialStatus={typeof sp.status === 'string' ? sp.status : ''} initialView={typeof sp.view === 'string' ? sp.view : 'list'} initialDate={typeof sp.date === 'string' ? sp.date : ''} />;
      case 'try-on': return <TryOnManagement />;
      case 'settings': return <SettingsPending />;
    }
  }
  if (path.length === 2) {
    switch (module) {
      case 'products': return <ProductEditor key={id} id={id} maxBytes={Number(process.env.IMAGE_MAX_BYTES) || 5242880} maxImages={Number(process.env.PRODUCT_MAX_IMAGES) || 10} />;
      case 'categories': return <CategoryEditor key={id} id={id} />;
      case 'collections': return <CollectionEditor key={id} id={id} />;
      case 'enquiries': return <CrmDetail key={id} kind="enquiries" id={id} />;
      case 'appointments': return id === 'availability' ? <AvailabilityEditor /> : <CrmDetail key={id} kind="appointments" id={id} />;
      case 'homepage': if (id === 'preview') return <CmsPreview />;
    }
  }
  if (path.length === 3 && module === 'homepage' && (id === 'sections' || id === 'banners')) return <CmsEditor key={`${id}/${child}`} kind={id} id={child} />;
  notFound();
}
