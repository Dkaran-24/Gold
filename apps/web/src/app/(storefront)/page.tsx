import Link from 'next/link';
import { Gem, MapPin, Sparkles } from 'lucide-react';
import { categories, collections, contactOptions, homepage, products } from '@/lib/server-api';
import { CollectionCard, ProductGrid } from '@/components/cards';
import { Campaign, CmsSection, Hero } from '@/components/home-sections';
import { Media } from '@/components/media';
import { EmptyState, SectionHeading, WhatsAppLink } from '@/components/ui';
import { ShowroomDetails } from '@/components/showroom-details';
import { safeCta } from '@/lib/catalogue';
import { showroomDetails, verifiedMapHref } from '@/lib/showroom-details';
import type { Product, PublicImage } from '@/lib/types';
import './homepage.css';

export const metadata = { alternates: { canonical: '/' } };

function Unavailable({ name, id }: { name: string; id: string }) {
  return <div className="home-unavailable" role="status"><div><h3>{name} couldn’t be loaded.</h3><p>Please try again shortly, or ask our showroom about this selection.</p></div><a className="text-link" href={'/?retry=' + id}>Retry this page <span aria-hidden="true">↗</span></a></div>;
}

const preferred = ['necklace', 'earring', 'ring', 'bangle', 'bracelet', 'mangalsutra', 'chain'];
function categoryRank(name: string) {
  const value = name.toLowerCase();
  const index = preferred.findIndex(word => value.includes(word));
  return index === -1 ? preferred.length : index;
}

function asImage(url: string | null | undefined, alt: string): PublicImage | null {
  return url ? { url, alt, width: null, height: null } : null;
}

function claimImage(image: PublicImage | null | undefined, used: Set<string>): PublicImage | null {
  if (!image?.url || used.has(image.url)) return null;
  used.add(image.url);
  return image;
}

export default async function Home() {
  const [home, categoryResult, contact, featured, edits] = await Promise.all([
    homepage(),
    categories(),
    contactOptions(),
    products('limit=8'),
    collections(1, 3),
  ]);
  const published = home.ok && home.value.data.version !== null;
  const sections = home.ok ? home.value.data.sections : [];
  const hero = sections.find(s => s.type === 'HERO') ?? null;
  const featuredSection = sections.find(s => s.type === 'FEATURED_PRODUCTS');
  const collectionSection = sections.find(s => s.type === 'FEATURED_COLLECTIONS');
  const storySection = sections.find(s => s.type === 'EDITORIAL');
  const customSection = sections.find(s => s.type === 'CUSTOM_JEWELLERY');
  const showroomSection = sections.find(s => s.type === 'APPOINTMENT');
  const handled = new Set([hero?.id, featuredSection?.id, collectionSection?.id, customSection?.id, storySection?.id, showroomSection?.id].filter(Boolean));
  const catalogueProducts: Product[] = featured.ok ? (featured.value.data.filter(p => p.featured).length ? featured.value.data.filter(p => p.featured) : featured.value.data).slice(0, 4) : featuredSection?.products ?? [];
  const heroImage = (published && hero?.desktopImage) || catalogueProducts.flatMap(p => p.images).find(image => !!image.url) || null;
  const featuredProducts = featuredSection?.products?.length ? featuredSection.products : catalogueProducts;
  const collectionCards = collectionSection?.collections?.length ? collectionSection.collections : edits.ok ? edits.value.data : [];
  const usedImages = new Set<string>();
  const heroPortrait = claimImage(heroImage, usedImages);
  const customImage: PublicImage = (published && customSection?.desktopImage?.url)
    ? customSection.desktopImage
    : {
        url: '/images/homepage/made-for-you-jewellery-design.jpg',
        alt: 'Handcrafted bespoke jewellery design sketch with fine diamond and ruby necklace on velvet',
        width: 985,
        height: 399,
      };
  const customPortrait = claimImage(customImage, usedImages) || customImage;
  const storyImage: PublicImage = (published && storySection?.desktopImage?.url)
    ? storySection.desktopImage
    : {
        url: '/images/homepage/our-story-gold-bangles.jpg',
        alt: 'Heritage handcrafted gold bangles with rubies on deep burgundy velvet',
        width: 972,
        height: 398,
      };
  const storyPortrait = claimImage(storyImage, usedImages) || storyImage;
  const showroomImage: PublicImage = (published && showroomSection?.desktopImage?.url)
    ? showroomSection.desktopImage
    : {
        url: '/images/showroom/shree-ram-jewellers-storefront.jpg',
        alt: 'Shree Ram Jewellers showroom storefront in Wadala with gold signboard and entrance display',
        width: 1198,
        height: 1313,
      };
  const showroomPortrait = claimImage(showroomImage, usedImages) || showroomImage;
  const sortedCategories = categoryResult.ok ? [...categoryResult.value].filter(c => c.visible !== false).sort((a, b) => categoryRank(a.name) - categoryRank(b.name) || a.sortOrder - b.sortOrder) : [];
  const directions = verifiedMapHref(showroomDetails.mapUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(showroomDetails.address)}`;
  const failed = [!home.ok && 'Homepage stories', !categoryResult.ok && 'Categories', !featured.ok && 'Featured jewellery', !edits.ok && 'Collections', !contact.ok && 'WhatsApp contact details'].filter((name): name is string => typeof name === 'string');
  const extra = sections.filter(s => !handled.has(s.id) && s.type !== 'APPOINTMENT');

  const APPROVED_HERO_HEADING = 'Jewellery That Becomes Part of Your Story.';
  const APPROVED_HERO_SUBTITLE = 'Shree Ram Jewellers';
  const APPROVED_HERO_DESCRIPTION = "Discover thoughtfully selected jewellery for life's most meaningful moments. Find a piece that reflects your style, celebrates your occasions and stays with you for years to come.";

  const rawHeading = hero?.heading?.trim();
  const hasValidHeading = rawHeading && rawHeading.toLowerCase() !== 'i love see t' && rawHeading.length >= 4;
  const heroHeading = (published && hasValidHeading) ? rawHeading : APPROVED_HERO_HEADING;

  const rawSubtitle = hero?.subtitle?.trim();
  const heroSubtitle = (published && rawSubtitle) ? rawSubtitle : APPROVED_HERO_SUBTITLE;

  const rawDescription = hero?.description?.trim();
  const heroDescription = (published && rawDescription) ? rawDescription : APPROVED_HERO_DESCRIPTION;

  const heroCtaLabel = (published && hero?.ctaLabel?.trim()) || 'Explore Jewellery';
  const heroCtaPath = (published && safeCta(hero?.ctaPath)) || '/products';

  return <div className="home-page">
    <Hero
      primary
      heading={heroHeading}
      subtitle={heroSubtitle}
      description={heroDescription}
      image={heroPortrait}
      mobileImage={published ? hero?.mobileImage : null}
      href={heroCtaPath}
      label={heroCtaLabel}
    />

    <section className="home-trust" aria-label="Showroom highlights">
      <div className="wrap home-trust-grid">
        <article>
          <Sparkles size={20} aria-hidden="true" />
          <div>
            <h2>Personalised Jewellery Assistance</h2>
            <p>Get guidance to help you explore jewellery for your occasion.</p>
          </div>
        </article>
        <article>
          <MapPin size={20} aria-hidden="true" />
          <div>
            <h2>Visit Our Wadala Showroom</h2>
            <p>Discover our jewellery collection in person.</p>
          </div>
        </article>
        <article>
          <Gem size={20} aria-hidden="true" />
          <div>
            <h2>Thoughtfully Selected Designs</h2>
            <p>Explore jewellery for different styles and occasions.</p>
          </div>
        </article>
      </div>
    </section>
    {failed.length > 0 && <aside className="wrap home-connection" aria-label="Online selection availability" role="status"><p>Some online selections are currently unavailable.</p><div className="home-connection-actions"><a href="/" className="text-link">Try again ↗</a><Link href="/contact" className="text-link">Ask the showroom ↗</Link></div></aside>}

    <section className="wrap section home-categories" id="home-categories" data-count={sortedCategories.length}>
      <div className="home-center">
        <p className="eyebrow">Explore our range</p>
        <h2>Find Your Expression</h2>
        <p>Explore jewellery that complements your style and celebrates every occasion.</p>
      </div>
      {categoryResult.ok ? sortedCategories.length ? <div className="category-grid" data-count={sortedCategories.length}>{sortedCategories.map(c => <Link key={c.id} href={`/products?categoryId=${c.id}`} className="category-card"><Media image={asImage(c.imageUrl, c.name)} alt={c.name} sizes="(max-width: 700px) 46vw, 280px" /><h3>{c.name}<span aria-hidden="true">→</span></h3></Link>)}</div> : <EmptyState title="Find something that feels like you" href="/contact" action="Tell us what you’re looking for">The online catalogue is awaiting its first pieces. Our showroom can help you explore what you have in mind.</EmptyState> : <Unavailable name="Jewellery categories" id="home-categories" />}
    </section>

    <section className="home-featured" id="home-featured">
      <div className="wrap section">
        <div className="home-center">
          <p className="eyebrow">Curated for you</p>
          <h2>Pieces Worth Remembering</h2>
        </div>
        {featured.ok || featuredSection ? <div className="home-product-shelf" data-count={featuredProducts.length}><ProductGrid products={featuredProducts} empty="Pieces worth remembering" description="Published jewellery will appear here when the showroom adds it to the catalogue." /></div> : <Unavailable name="Featured jewellery" id="home-featured" />}
      </div>
    </section>

    <section className="wrap section" id="home-collections">
      <div className="home-center">
        <p className="eyebrow">Collections</p>
        <h2>Stories Told Through Jewellery</h2>
        <p>Explore collections thoughtfully brought together for moments that matter.</p>
      </div>
      {edits.ok || collectionSection ? collectionCards.length ? <div className="collection-grid home-collection-grid" data-count={collectionCards.length}>{collectionCards.map(c => <CollectionCard key={c.id} collection={c} />)}</div> : <EmptyState title="Collections will appear here">Published collections are shown once the showroom shares them.</EmptyState> : <Unavailable name="Collections" id="home-collections" />}
    </section>

    <section className="home-split home-split-cream" id="home-custom">
      <div className="home-split-copy">
        <p className="eyebrow">Made for you</p>
        <h2>Something Made Just for You</h2>
        <p>Have an idea in mind? Let us help you explore a piece that feels uniquely yours.</p>
        <Link className="button" href="/custom-jewellery">Discover Made for You</Link>
      </div>
      <div className="home-split-media">
        <Media
          image={customPortrait}
          mobileImage={published ? customSection?.mobileImage : null}
          alt={customPortrait.alt || 'Bespoke jewellery design conversation with Shree Ram Jewellers'}
          sizes="(max-width: 800px) 100vw, 50vw"
        />
      </div>
    </section>

    <section className="home-split" id="home-story">
      <div className="home-split-media">
        <Media
          image={storyPortrait}
          mobileImage={published ? storySection?.mobileImage : null}
          alt={storyPortrait.alt || 'Shree Ram Jewellers heritage craftsmanship and hallmarked gold jewellery'}
          sizes="(max-width: 800px) 100vw, 50vw"
        />
      </div>
      <div className="home-split-copy">
        <p className="eyebrow">Our story</p>
        <h2>Jewellery chosen with care in Wadala.</h2>
        <p>{storySection?.description || 'Shree Ram Jewellers is a Wadala showroom for pieces you can explore online, keep on a wishlist, or talk through in person.'}</p>
        <Link className="text-link" href="/about">Read our story <span aria-hidden="true">↗</span></Link>
      </div>
    </section>

    <section className="home-split home-split-cream" id="home-showroom">
      <div className="home-split-copy">
        <p className="eyebrow">The showroom</p>
        <h2>{(published && showroomSection?.heading?.trim()) || 'We Would Love to Welcome You'}</h2>
        <p className="home-showroom-desc">
          {(published && showroomSection?.description?.trim()) || 'Visit our physical jewellery showroom in Wadala to explore hallmarked gold, fine jewellery, and bespoke designs in person with our dedicated guidance.'}
        </p>
        <ShowroomDetails />
        <div className="hero-actions">
          <Link className="button" href={showroomSection?.ctaPath || '/appointments'}>{showroomSection?.ctaLabel || 'Visit the Showroom'}</Link>
          <a className="button button-outline" href={directions} target="_blank" rel="noopener noreferrer">Directions <span className="sr-only">(opens a map in a new tab)</span></a>
        </div>
      </div>
      <div className="home-split-media home-showroom-media">
        {showroomPortrait ? (
          <Media
            image={showroomPortrait}
            mobileImage={published ? showroomSection?.mobileImage : null}
            alt="Shree Ram Jewellers showroom storefront in Wadala with gold signboard and entrance display"
            sizes="(max-width: 800px) 100vw, 50vw"
            className="home-showroom-media-frame"
          />
        ) : (
          <div className="media image-fallback home-showroom-panel" role="img" aria-label="Shree Ram Jewellers Wadala Showroom">
            <p>Wadala</p>
            <span>Showroom</span>
          </div>
        )}
      </div>
    </section>

    {published && extra.map(s => <CmsSection key={s.id} section={s} />)}
    {published && home.ok && home.value.data.banners.length > 0 && <div className="wrap section campaign-stack">{home.value.data.banners.map(b => <Campaign key={b.id} banner={b} />)}</div>}
    {contact.ok && contact.value.data.whatsappNumber && <section className="wrap whatsapp-section"><div><p className="eyebrow">A conversation away</p><h2>A question about a piece?</h2></div><WhatsAppLink number={contact.value.data.whatsappNumber} /></section>}
  </div>;
}
