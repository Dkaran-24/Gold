import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui';
import { contactOptions } from '@/lib/server-api';
import { CatalogueStudio } from '@/components/try-on/catalogue-studio';
import './studio.css';

export const metadata: Metadata = {
  title: 'Virtual Jewellery Try-On',
  description: 'See how Shree Ram Jewellers necklaces and earrings look on you with a private, on-device virtual fitting.',
  alternates: { canonical: '/custom-jewellery' },
};

export default async function CustomJewellery() {
  const contact = await contactOptions();
  const whatsappNumber = contact.ok ? contact.value.data.whatsappNumber : null;

  return (
    <div className="wrap virtual-studio-page">
      <Breadcrumbs items={[{ label: 'Virtual try-on' }]} />
      <CatalogueStudio whatsappNumber={whatsappNumber} />
    </div>
  );
}

