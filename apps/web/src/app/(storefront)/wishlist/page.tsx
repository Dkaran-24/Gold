import type { Metadata } from 'next';
import { Wishlist } from '@/components/wishlist';
import { Breadcrumbs, PageIntro } from '@/components/ui';
export const metadata: Metadata = { title: 'Your wishlist', robots: { index: false, follow: true } };
export default function WishlistPage() { return <div className="wrap section-bottom"><Breadcrumbs items={[{ label: 'Wishlist' }]} /><PageIntro eyebrow="A little collection of your own" title="The pieces you keep coming back to.">Your favourites, saved here for another look.</PageIntro><Wishlist /></div>; }
