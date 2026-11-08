'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, SwitchCamera } from 'lucide-react';
import { cameraError, openCamera, stopTracks } from '@/lib/try-on/camera';
import { displayTransform } from '@/lib/try-on/tracking';
import type { OverlayAsset } from '@/lib/try-on/types';

export function LiveCamera({ asset }: { asset: OverlayAsset }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef<AbortController | null>(null);
  const [front, setFront] = useState(true);
  const [running, setRunning] = useState(false);
  const [supported, setSupported] = useState(false);
  const [hint, setHint] = useState('');
  useEffect(() => {
    setSupported(!!navigator.mediaDevices?.getUserMedia && window.isSecureContext && typeof WebGL2RenderingContext !== 'undefined');
    const hidden = () => {
      if (document.hidden) {
        active.current?.abort();
        setRunning(false);
        setHint('Camera stopped while this page was hidden.');
      }
    };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); active.current?.abort(); };
  }, []);
  function stop() {
    active.current?.abort();
    active.current = null;
    setRunning(false);
    setHint('Camera stopped.');
  }
  async function start(useFront: boolean) {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    const player = video.current, overlay = canvas.current;
    if (!player || !overlay) return;
    setFront(useFront);
    setRunning(true);
    setHint('Waiting for camera permission…');
    const fail = (error: unknown) => {
      if (!signal.aborted) {
        stop();
        setHint(cameraError(error));
      }
    };
    try {
      const stream = await openCamera(navigator.mediaDevices, window.isSecureContext, useFront, signal);
      signal.addEventListener('abort', () => {
        stopTracks(stream);
        player.pause();
        player.srcObject = null;
      }, { once: true });
      // A stop can interleave with resolution of the permission prompt.
      if (signal.aborted) { stopTracks(stream); return; }
      const track = stream.getVideoTracks()[0];
      track?.addEventListener('ended', () => fail(new Error('Camera disconnected')), {signal});
      const facing = track?.getSettings().facingMode;
      setFront(facing ? facing === 'user' : useFront);
      player.srcObject = stream;
      await player.play();
      signal.throwIfAborted();
      setHint('Preparing local tracking…');
      const { trackJewellery } = await import('@/lib/try-on/renderer');
      await trackJewellery(player, overlay, asset, signal, setHint, () => fail(new Error('Tracking unavailable')));
    } catch (error) { fail(error); }
  }
  return <section className="try-panel try-live-panel" aria-label="Live camera fitting">
    <div className="try-panel-heading"><p className="eyebrow">The live experience</p><h2>Every angle. All you.</h2><p>See how a detail follows your movement.</p></div>
    <div className="try-stage">
      <div className="try-camera-status"><span className={running?'is-on':''}/>{!supported?'Camera unavailable':!running?'Camera off':hint.includes('permission')?'Permission pending':hint.includes('Preparing')?'Preparing your fitting':hint==='Tracking your movement'?'Jewellery overlay active':'Camera fitting in progress'}</div>
      <div className="try-video-layers" hidden={!running} style={{ transform: displayTransform(front) }}>
        <video ref={video} muted playsInline aria-label="Live camera preview" />
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      {!running&&<div className="try-camera-empty"><div className="try-camera-frame"><Camera size={35} strokeWidth={1} aria-hidden="true"/></div><h3>Your mirror, reimagined.</h3><p>When you are ready, find a little light<br/>and make room for a new favourite.</p></div>}
      <div className="try-camera-toolbar">
        {running ? <><button className="button" onClick={stop}><CameraOff size={17}/> Close camera</button><button className="button button-outline" onClick={() => start(!front)}><SwitchCamera size={17}/> Switch camera</button></>
          : <button className="button" disabled={!supported} onClick={() => start(true)}><Camera size={17}/> Open my camera</button>}
      </div>
    </div>
    <p className="try-hint" role="status">{!supported ? 'Live preview requires a secure browser with camera access and WebGL 2.' : hint || 'Use even lighting and keep your face and neckline visible.'}</p>
    <p className="try-private-note">Only you and your mirror. Live camera frames and landmarks stay on this device and are never sent to Gemini. Opening the camera asks your browser for permission.</p>
  </section>;
}

