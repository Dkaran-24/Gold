import Link from 'next/link';
export default function NotFound() { return <div className="wrap section error-page"><p className="eyebrow">A different path</p><h1>This page is no longer here.</h1><p>The piece or collection may have been withdrawn, or the address may have changed.</p><Link className="button" href="/products">Explore jewellery ↗</Link></div>; }
