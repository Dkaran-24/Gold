import { notFound } from 'next/navigation';
import { product, contactOptions } from '@/lib/server-api';
import { Breadcrumbs, ErrorState } from '@/components/ui';
import { Studio } from '@/components/try-on/studio';
import './try-on.css';

export const metadata = { title: 'Virtual fitting room', robots:{index:false,follow:false} };

export default async function TryOnPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{mode?:string}>}) {
  const {slug} = await params;
  const [result, contact] = await Promise.all([product(slug), contactOptions()]);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <div className="wrap section"><ErrorState message={result.error} href={'/try-on/'+encodeURIComponent(slug)}/></div>;
  }
  const {id, name} = result.value.data;
  const mode=(await searchParams).mode==='live'?'live':'photo';
  return <div className="wrap"><Breadcrumbs items={[{label:'Jewellery',href:'/products'},{label:name,href:'/products/'+encodeURIComponent(slug)},{label:'Try it on'}]}/>
    <Studio key={id} product={result.value.data} initialMode={mode} whatsappNumber={contact.ok ? contact.value.data.whatsappNumber : null}/>
  </div>;
}

