import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui';
import { showroomDetails, verifiedMapHref } from '@/lib/showroom-details';
import styles from './about.module.css';

export const metadata: Metadata = {
  title: 'About Shree Ram Jewellers',
  description: 'Jewellery for your stories, celebrations and everyday moments. Discover Shree Ram Jewellers and visit our showroom in Wadala, Mumbai.',
  alternates: { canonical: '/about' },
};

const experiences = [
  { title: 'Discover Your Style', copy: 'Explore jewellery designs and find pieces that reflect your preferences. Begin with the details that catch your eye.' },
  { title: 'Find Something Meaningful', copy: 'Discover jewellery for celebrations, special occasions and everyday moments. A little reminder of what matters to you.' },
  { title: 'Personal Assistance', copy: 'Connect with our showroom team for assistance with your jewellery enquiries. Your next discovery can start with a conversation.' },
];
function Arrow() { return <ArrowUpRight size={17} strokeWidth={1.5} aria-hidden="true" />; }

export default function About() {
  const directions = verifiedMapHref(showroomDetails.mapUrl);
  return <div className={styles.page}>
    <div className="wrap"><Breadcrumbs items={[{ label: 'Our Story' }]} /></div>
    <section className={`wrap ${styles.hero}`} aria-labelledby="about-title">
      <div className={styles.heroCopy}>
        <p className="eyebrow">Our story · Shree Ram Jewellers</p>
        <h1 id="about-title">Jewellery is<br />more than <em>what you wear.</em></h1>
        <p className={styles.body}>Every piece carries a memory, celebrates a moment and becomes part of your story. At Shree Ram Jewellers, we invite you to discover jewellery that feels personal.</p>
        <Link className="button" href="/products">Explore Our Collection <Arrow /></Link>
        <p className={styles.signature}>Personal stories. Meaningful pieces.</p>
      </div>
      <figure className={styles.heroFigure}>
        <div className={styles.heroImage}><Image src="/images/homepage/our-story-gold-bangles.jpg" alt="Gold bangles with intricate detailing on burgundy velvet" fill sizes="(max-width: 760px) 100vw, 55vw" preload /></div>
        <figcaption><span>A detail to remember</span><span>Shree Ram Jewellers</span></figcaption>
      </figure>
    </section>
    <section className={`wrap ${styles.philosophy}`} aria-labelledby="philosophy-title">
      <figure className={styles.philosophyFigure}>
        <div className={styles.philosophyImage}><Image src="/images/homepage/made-for-you-jewellery-design.jpg" alt="A jewellery sketch beside an ornate necklace on velvet" fill sizes="(max-width: 760px) 100vw, 48vw" /></div>
        <figcaption>From the smallest detail to the meaning it holds.</figcaption>
      </figure>
      <div className={styles.philosophyCopy}>
        <p className="eyebrow">Our philosophy</p><h2 id="philosophy-title">Every piece<br />has a story.</h2>
        <p className={styles.body}>A celebration shared. A new chapter begun. A quiet expression of who you are. Jewellery becomes meaningful through the moments and memories you bring to it.</p>
        <p className={styles.body}>We believe choosing a piece should feel personal. Whether you are drawn to a familiar design or something unexpected, there is room to explore what feels like you.</p>
        <Link className="text-link" href="/collections">Discover the collections <Arrow /></Link>
      </div>
    </section>
    <section className={styles.experience} aria-labelledby="experience-title">
      <div className="wrap">
        <div className={styles.experienceHeading}><div><p className="eyebrow">The jewellery experience</p><h2 id="experience-title">A discovery that’s yours.</h2></div><p>Take a closer look.<br />Follow what speaks to you.</p></div>
        <ol className={styles.experienceList}>{experiences.map((item, index) => <li key={item.title}><span className={styles.number} aria-hidden="true">0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p></li>)}</ol>
      </div>
    </section>
    <section className={styles.showroom} id="showroom" aria-labelledby="showroom-title">
      <div className={`wrap ${styles.showroomGrid}`}>
        <figure className={styles.storeFigure}><Image src="/images/showroom/shree-ram-jewellers-storefront.jpg" alt="The entrance and jewellery displays at Shree Ram Jewellers in Wadala" width={1198} height={1313} sizes="(max-width: 760px) 100vw, 46vw" /></figure>
        <div className={styles.showroomCopy}>
          <p className="eyebrow">Our showroom · Mumbai</p><h2 id="showroom-title">Visit us<br />in Wadala.</h2>
          <p className={styles.body}>See the details up close. Explore the jewellery in person and speak with our team about the pieces that catch your eye.</p>
          <div className={styles.address}><span className="eyebrow">Find us here</span><address>{showroomDetails.address}</address></div>
          <div className="button-row">{directions && <a className="button" href={directions} target="_blank" rel="noopener noreferrer">Get Directions <Arrow /></a>}<Link href="/contact" className={`button ${directions ? 'button-outline' : ''}`}>Contact Us <Arrow /></Link></div>
        </div>
      </div>
    </section>
    <section className={styles.closing} aria-labelledby="closing-title">
      <div className="wrap"><p className="eyebrow">Your next chapter</p><h2 id="closing-title">Find a piece that<br /><em>feels like yours.</em></h2><p>Explore our jewellery collection and discover something worth remembering.</p><div className={`button-row ${styles.closingActions}`}><Link className="button" href="/products">Explore Jewellery <Arrow /></Link><a className="button button-outline" href="#showroom">Visit Our Showroom <Arrow /></a></div></div>
    </section>
  </div>;
}

