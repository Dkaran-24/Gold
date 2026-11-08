'use client';
import {createContext,useContext,useEffect,useRef,useState} from 'react';

const ConfirmationContext=createContext<(message:string)=>Promise<boolean>>(async()=>false);
export const useConfirmation=()=>useContext(ConfirmationContext);

export function ConfirmationProvider({children}:{children:React.ReactNode}){
  const [message,setMessage]=useState('');
  const pending=useRef<((answer:boolean)=>void)|null>(null);
  const cancelButton=useRef<HTMLButtonElement>(null);
  const acceptButton=useRef<HTMLButtonElement>(null);
  const previousFocus=useRef<HTMLElement|null>(null);
  function close(answer:boolean){pending.current?.(answer);pending.current=null;setMessage('');previousFocus.current?.focus();}
  function confirm(message:string){if(pending.current)return Promise.resolve(false);previousFocus.current=document.activeElement as HTMLElement;setMessage(message);return new Promise<boolean>(resolve=>{pending.current=resolve;});}
  useEffect(()=>{if(message)cancelButton.current?.focus();},[message]);
  useEffect(()=>()=>{pending.current?.(false);},[]);
  return <ConfirmationContext.Provider value={confirm}>{children}{message&&<div className="admin-app a-confirm-backdrop"><section className="a-confirm" role="alertdialog" aria-modal="true" aria-labelledby="a-confirm-title" aria-describedby="a-confirm-message" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();close(false);}if(event.key==='Tab'){if(event.shiftKey&&document.activeElement===cancelButton.current){event.preventDefault();acceptButton.current?.focus();}else if(!event.shiftKey&&document.activeElement===acceptButton.current){event.preventDefault();cancelButton.current?.focus();}}}}><p className="a-eyebrow">PLEASE REVIEW</p><h2 id="a-confirm-title">Confirm this change</h2><p id="a-confirm-message">{message}</p><div className="a-actions"><button ref={cancelButton} className="a-btn" onClick={()=>close(false)}>Keep unchanged</button><button ref={acceptButton} className="a-btn a-primary" onClick={()=>close(true)}>Confirm change</button></div></section></div>}</ConfirmationContext.Provider>;
}
