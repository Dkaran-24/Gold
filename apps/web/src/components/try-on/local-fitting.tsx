'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, Upload, Maximize, Download, RotateCcw } from 'lucide-react';
import { cameraError, openCamera, stopTracks } from '@/lib/try-on/camera';
import { decodePhoto } from '@/lib/try-on/photo';
import type { OverlayAsset } from '@/lib/try-on/types';

export function LocalFitting({asset}:{asset:OverlayAsset|null}) {
  const video = useRef<HTMLVideoElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<AbortController|null>(null);
  const tracking = useRef<AbortController|null>(null);
  const renderQueue = useRef<Promise<void>>(Promise.resolve());
  const uploadVersion = useRef(0);
  const [photo,setPhoto] = useState<HTMLCanvasElement|null>(null);
  const [running,setRunning] = useState(false);
  const [pending,setPending] = useState(false);
  const [front,setFront] = useState(true);
  const [hint,setHint] = useState('Choose a photograph or start your camera.');
  const [error,setError] = useState('');
  const [ready,setReady] = useState(false);
  const [revision,setRevision] = useState(0);
  const [fullscreen,setFullscreen] = useState(false);
  const [switchable,setSwitchable] = useState(false);
  const hasSource = running || !!photo;

  function stop() {
    camera.current?.abort(); camera.current=null;
    // The source effect owns renderer cleanup. A cancelled permission prompt
    // must not discard a still-photo fitting that is already on screen.
    setRunning(false); setPending(false);
  }
  useEffect(()=>{
    setFullscreen(!!document.fullscreenEnabled);
    const hidden=()=>{if(document.hidden){stop();setHint('Camera stopped while the studio was hidden.');}};
    document.addEventListener('visibilitychange',hidden);
    return ()=>{document.removeEventListener('visibilitychange',hidden); camera.current?.abort(); tracking.current?.abort(); uploadVersion.current++;};
  },[]);
  useEffect(()=>{
    if(photo && base.current){base.current.width=photo.width;base.current.height=photo.height;base.current.getContext('2d')?.drawImage(photo,0,0);}
  },[photo]);
  useEffect(()=>{
    setReady(false);setError('');
    const source=running?video.current:photo;
    if (!source || !overlay.current || !asset) {setHint(hasSource?'Select a piece to begin your fitting.':'Choose a photograph or start your camera.');return;}
    const controller=new AbortController();tracking.current=controller;
    const target=overlay.current;
    setHint('Preparing your fitting on this device…');
    const fail=()=>{if(!controller.signal.aborted){controller.abort();setReady(false);setError('Jewellery tracking is unavailable. Try again, or choose a clearer photograph.');}};
    renderQueue.current=renderQueue.current.catch(()=>{}).then(async()=>{
      const {trackJewellery}=await import('@/lib/try-on/renderer');
      if(controller.signal.aborted)return;
      await trackJewellery(source,target,asset,controller.signal,message=>{
        if(!controller.signal.aborted){setHint(message);setReady(message==='Tracking your movement'||message==='Jewellery preview ready');}
      },fail);
    }).catch(fail);
    return ()=>controller.abort();
  },[asset,photo,running,revision,hasSource]);

  async function start(useFront=true) {
    stop(); uploadVersion.current++;setError('');
    const controller=new AbortController();camera.current=controller;
    setPending(true);setHint('Waiting for camera permission…');
    try {
      const stream=await openCamera(navigator.mediaDevices,window.isSecureContext,useFront,controller.signal);
      const player=video.current;
      if(!player){stopTracks(stream);return;}
      controller.signal.addEventListener('abort',()=>{stopTracks(stream);player.pause();player.srcObject=null;},{once:true});
      if(controller.signal.aborted){stopTracks(stream);return;}
      stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(!controller.signal.aborted){stop();setError('The camera disconnected. Start it again or upload a photo.');}},{signal:controller.signal});
      player.srcObject=stream;await player.play();controller.signal.throwIfAborted();
      const facing=stream.getVideoTracks()[0]?.getSettings().facingMode;
      setFront(facing?facing==='user':useFront);setPhoto(null);setRunning(true);setPending(false);
      navigator.mediaDevices.enumerateDevices().then(devices=>{if(!controller.signal.aborted)setSwitchable(devices.filter(d=>d.kind==='videoinput').length>1);}).catch(()=>{});
    } catch(e){if(!controller.signal.aborted){stop();setError(cameraError(e));}}
  }
  async function upload(file?:File) {
    if(!file)return;
    const version=++uploadVersion.current;setError('');setHint('Opening photograph on this device…');
    try {const next=await decodePhoto(file);if(version!==uploadVersion.current)return;stop();setPhoto(next);}
    catch(e){if(version===uploadVersion.current){setError(e instanceof Error?e.message:'Unable to open photograph.');setHint('Choose another photograph to continue.');}}
  }
  function capture() {
    const player=video.current;
    if(!player || player.readyState<2)return;
    const next=document.createElement('canvas');next.width=player.videoWidth;next.height=player.videoHeight;
    const ctx=next.getContext('2d');if(!ctx)return;
    // Keep the source unmirrored for landmarks; photo display uses the same orientation.
    ctx.drawImage(player,0,0);stop();setFront(false);setPhoto(next);setError('');
  }
  function remove() {uploadVersion.current++;stop();setPhoto(null);setError('');if(base.current){base.current.width=1;base.current.height=1;}}
  function save() {
    if(!ready || !overlay.current)return;
    const source=running?video.current:photo;if(!source)return;
    try {
      const output=document.createElement('canvas');output.width=overlay.current.width;output.height=overlay.current.height;
      const ctx=output.getContext('2d');if(!ctx)throw new Error();
      if(running&&front){ctx.translate(output.width,0);ctx.scale(-1,1);}
      ctx.drawImage(source,0,0,output.width,output.height);ctx.drawImage(overlay.current,0,0);
      output.toBlob(blob=>{if(!blob){setError('Preview could not be saved. Please try again.');return;}
        const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='shree-ram-virtual-preview.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      },'image/png');
    }catch{setError('This jewellery image cannot be exported. Please try another piece or contact the showroom.');}
  }
  return <section className="local-fitting" aria-label="Your virtual mirror">
    <div className="vs-preview-heading"><span className="eyebrow">YOUR PERSONAL MIRROR</span><span>{running?'Camera on':photo?'Your photograph':'Private by design'}</span></div>
    <div className="vs-stage" ref={stage}>
      <div className="vs-layers" hidden={!hasSource} style={{transform:running&&front?'scaleX(-1)':'none'}}>
        <video ref={video} muted playsInline hidden={!running} aria-label="Live camera preview"/>
        <canvas ref={base} hidden={running||!photo} aria-label="Your uploaded photograph"/>
        <canvas ref={overlay} className="vs-overlay" hidden={!asset||!hasSource} aria-label="Jewellery fitting overlay"/>
      </div>
      {!hasSource&&<div className="vs-welcome"><span className="vs-mirror-icon"><Camera size={38} strokeWidth={1}/></span><p className="eyebrow">A LITTLE LIGHT. A NEW PERSPECTIVE.</p><h2>Make it yours.</h2><p>Your favourite piece, seen on you.<br/>Begin with your camera or a photograph.</p></div>}
      {fullscreen&&hasSource&&<button className="vs-fullscreen" aria-label="Toggle full-screen preview" onClick={()=>{const action=document.fullscreenElement?document.exitFullscreen():stage.current?.requestFullscreen();action?.catch(()=>setError('Full-screen preview is unavailable.'));}}><Maximize size={20}/></button>}
    </div>
    <div className="vs-controls">
      {!running?<button className="button" disabled={pending} onClick={()=>start()}><Camera size={18}/>{pending?'Starting camera…':'Start camera'}</button>:<><button className="button" onClick={capture}><Camera size={18}/>Capture photograph</button>{switchable&&<button className="button button-outline" onClick={()=>start(!front)}>Switch camera</button>}</>}
      {(running||pending)&&<button className="button button-outline" onClick={stop}>Stop camera</button>}
      <button className="button button-outline" onClick={()=>input.current?.click()}><Upload size={18}/>{photo?'Change photograph':'Upload photograph'}</button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Upload your photograph" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>
    </div>
    {hasSource&&<div className="vs-controls vs-secondary"><button onClick={save} disabled={!ready}><Download size={16}/>Save preview</button><button onClick={()=>{setError('');setRevision(v=>v+1);}} disabled={!asset}><RotateCcw size={16}/>Reset fitting</button><button onClick={remove}>Remove photograph / reset</button></div>}
    <p className="vs-status" role="status">{hint}</p>
    {error&&<p className="notice" role="alert">{error}</p>}
    <p className="vs-privacy">Your photographs and camera frames stay on this device. Nothing is uploaded or retained by the showroom. JPG, PNG or WebP · up to 10 MB. Use an evenly lit, front-facing photo with your ears, neckline and shoulders visible.</p>
  </section>;
}

