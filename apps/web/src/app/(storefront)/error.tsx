'use client';
import Link from 'next/link';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <div className="wrap section error-page"><p className="eyebrow">A little pause</p><h1>We couldn’t open this page.</h1><p>Please try again in a moment.</p><div className="button-row"><button className="button" type="button" onClick={reset}>Try again</button><Link className="button button-outline" href="/">Back to home</Link></div></div>; }
