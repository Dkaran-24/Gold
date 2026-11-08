import {ownerSession} from '@/lib/admin/session';
import {AdminShell} from '@/components/admin/shell';
export default async function OwnerLayout({children}:{children:React.ReactNode}){const owner=await ownerSession();return <AdminShell owner={owner}>{children}</AdminShell>;}
