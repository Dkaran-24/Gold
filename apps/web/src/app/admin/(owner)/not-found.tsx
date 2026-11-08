import Link from 'next/link';
export default function MissingAdminPage(){return <div className="a-empty"><h1>Page not found</h1><p>This dashboard address does not exist.</p><Link className="a-btn" href="/admin">Return to overview</Link></div>;}
