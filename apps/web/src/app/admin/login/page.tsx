import {Login} from '@/components/admin/login';
export default async function LoginPage({searchParams}:{searchParams:Promise<{expired?:string}>}){return <Login expired={(await searchParams).expired==='1'}/>;}
