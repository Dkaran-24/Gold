import Link from 'next/link';
import { contactOptions } from '@/lib/server-api';
import { showroomContactLinks, showroomDetails } from '@/lib/showroom-details';
import { WhatsAppLink } from './ui';

export async function SiteFooter() {
  const contact = await contactOptions();
  const channels = showroomContactLinks(showroomDetails);
  return <footer className="site-footer"><div className="wrap footer-grid"><div className="footer-brand"><Link className="wordmark" href="/"><span className="brand-symbol" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="currentColor"/></svg></span><span className="wordmark-text">SHREE RAM<small>JEWELLERS</small></span></Link><p>Jewellery for the moments you want to remember, chosen with care at our Wadala showroom.</p></div><div><h2>Explore</h2><Link href="/products">Jewellery</Link><Link href="/collections">Collections</Link><Link href="/custom-jewellery">Virtual Try-On</Link><Link href="/about">Our Story</Link></div><div><h2>Customer information</h2><Link href="/contact">Contact</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms and Conditions</Link></div><div className="footer-note"><h2>Showroom</h2><p className="footer-address">{showroomDetails.address}</p>{channels.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}{contact.ok && contact.value.data.whatsappNumber ? <WhatsAppLink number={contact.value.data.whatsappNumber} className="text-link" label="Message on WhatsApp" /> : <Link className="text-link" href="/contact">Contact the showroom ↗</Link>}</div></div><div className="wrap footer-bottom"><p>© {new Date().getFullYear()} Shree Ram Jewellers</p><p>Wadala, Mumbai</p></div></footer>;
}

