import { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { placements, smooth, type Landmark, type Placement } from './tracking';
import type { OverlayAsset } from './types';
import { insidePhoto, pixelViewport, RenderLifetime, RenderSessions } from './render-state';

const sessions=new RenderSessions<HTMLCanvasElement>();

export async function trackJewellery(
  video: HTMLVideoElement | HTMLCanvasElement, canvas: HTMLCanvasElement, asset: OverlayAsset,
  signal: AbortSignal, report: (hint: string) => void, onFailure: () => void,
) {
  return sessions.run(canvas,signal,sessionSignal=>renderJewellery(video,canvas,asset,sessionSignal,report,onFailure));
}

async function renderJewellery(
  video:HTMLVideoElement|HTMLCanvasElement,canvas:HTMLCanvasElement,asset:OverlayAsset,
  signal:AbortSignal,report:(hint:string)=>void,onFailure:()=>void,
) {
  const live = video instanceof HTMLVideoElement;
  let face: FaceLandmarker | undefined;
  let pose: PoseLandmarker | undefined;
  let renderer: THREE.WebGLRenderer | undefined;
  let texture: THREE.Texture | undefined;
  let animation = 0;
  const sprites: THREE.Sprite[] = [];
  const lifetime=new RenderLifetime();
  const dispose=()=>lifetime.close();
  signal.addEventListener('abort',dispose,{once:true});
  lifetime.add(()=>signal.removeEventListener('abort',dispose));
  lifetime.add(()=>cancelAnimationFrame(animation));
  try {
    signal.throwIfAborted();
    const files = await FilesetResolver.forVisionTasks('/try-on/wasm');
    signal.throwIfAborted();
    face = await FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/try-on/models/face_landmarker.task' },
      runningMode: live ? 'VIDEO' : 'IMAGE', numFaces: 1,
    });
    const ownedFace=face;lifetime.add(()=>ownedFace.close());
    signal.throwIfAborted();
    if (asset.kind === 'NECKLACE') {
      pose = await PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/try-on/models/pose_landmarker_lite.task' },
        runningMode: live ? 'VIDEO' : 'IMAGE', numPoses: 1, outputSegmentationMasks: false,
      });
      const ownedPose=pose;lifetime.add(()=>ownedPose.close());
      signal.throwIfAborted();
    }
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true });
    const ownedRenderer=renderer;lifetime.add(()=>{try{ownedRenderer.clear();}finally{ownedRenderer.dispose();}});
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
    texture = await new THREE.TextureLoader().loadAsync(asset.url);
    const ownedTexture=texture;lifetime.add(()=>ownedTexture.dispose());
    signal.throwIfAborted();
    texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 10);
    camera.position.z = 1;
    for (let index = 0; index < (asset.kind === 'EARRINGS' ? 2 : 1); index++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
      sprite.center.set(0.5, 1);
      sprite.visible = false;
      scene.add(sprite);
      sprites.push(sprite);
      lifetime.add(()=>{scene.remove(sprite);sprite.material.dispose();});
    }
    const bitmap = texture.image as HTMLImageElement;
    if (!bitmap.naturalWidth || !bitmap.naturalHeight) throw new Error('Overlay image unavailable');
    const aspect = bitmap.naturalHeight / bitmap.naturalWidth;
    const meter = document.createElement('canvas');
    meter.width = meter.height = 8;
    const context = meter.getContext('2d', { willReadFrequently: true });
    let dark = false;
    let time = -1, lastDetect = -1000, lastLight = -1000, lastPose = -1000, interval = 83;
    let posePoints: Landmark[] = [];
    let previous: Placement[] = [];
    let hint = '';
    let viewportWidth=0,viewportHeight=0;
    const tick = (now: number) => {
      if (signal.aborted) return;
      try {
        if ((!live || (video.readyState >= 2 && video.currentTime !== time)) && now - lastDetect >= interval) {
          const w = live ? video.videoWidth : video.width, h = live ? video.videoHeight : video.height;
          time = live ? video.currentTime : 0;
          if (viewportWidth !== w || viewportHeight !== h) {
            renderer!.setSize(w, h, false);
            pixelViewport(camera,w,h);
            viewportWidth=w;viewportHeight=h;
            previous = [];
          }
          if (context && now - lastLight >= 850) {
            context.drawImage(video, 0, 0, 8, 8);
            const pixels = context.getImageData(0, 0, 8, 8).data;
            let brightness = 0;
            for (let i = 0; i < pixels.length; i += 4) brightness += (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3;
            dark = brightness / 64 < 38;
            lastLight = now;
          }
          const facePoints = (live ? face!.detectForVideo(video, now) : face!.detect(video)).faceLandmarks[0] || [];
          if (!facePoints.length) { posePoints = []; lastPose = -1000; }
          if (pose && facePoints.length && now - lastPose >= 150) {
            const result = live ? pose.detectForVideo(video, now) : pose.detect(video);
            posePoints = result.landmarks[0] || [];
            result.close();
            lastPose = now;
          }
          const next = placements(facePoints, posePoints, asset, w, h);
          previous = next.map((point, i) => smooth(previous[i], point, now - lastDetect));
          sprites.forEach((sprite, i) => {
            const point = previous[i];
            sprite.visible = !!point && !dark && insidePhoto(point,aspect,w,h);
            if (point) {
              sprite.position.set(point.x, h - point.y, 0);
              sprite.scale.set(point.width, point.width * aspect, 1);
              sprite.material.rotation = -point.rotation;
            }
          });
          const message = dark ? 'More light will help the preview.' : !facePoints.length ? 'Use a front-facing view with your face and ears visible.' : !next.length ? 'Keep both shoulders and your face in view.' : !sprites.some(s=>s.visible) ? 'Step back or use a wider photograph so the jewellery fits in view.' : live ? 'Tracking your movement' : 'Jewellery preview ready';
          if (message !== hint) { report(message); hint = message; }
          renderer!.render(scene, camera);
          lastDetect = now;
          interval = Math.max(83, Math.min(400, (performance.now() - now) * 2.5));
        }
        if (live) animation = requestAnimationFrame(tick);
      } catch { dispose();onFailure(); }
    };
    signal.throwIfAborted();
    animation = requestAnimationFrame(tick);
  } catch (error) {
    dispose();
    throw error;
  }
}

