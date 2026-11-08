'use client';
export default function AdminError({reset}:{reset:()=>void}) {return <div className="admin-app a-empty" role="alert"><h1>Dashboard unavailable</h1><p>The owner service could not be reached. Please try again.</p><button className="a-btn" onClick={reset}>Retry</button><a className="a-btn" href="/admin/login">Sign in</a></div>;}
