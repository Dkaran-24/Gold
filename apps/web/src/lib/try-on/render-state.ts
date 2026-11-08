import type { OrthographicCamera } from 'three';
import type { Placement } from './tracking';

/** Camera bounds belong to the renderer instance, not to the reused DOM canvas. */
export function pixelViewport(camera:OrthographicCamera,width:number,height:number) {
  if(width<=0 || height<=0)throw new Error('Invalid preview dimensions');
  camera.left=0;camera.right=width;camera.top=height;camera.bottom=0;
  camera.updateProjectionMatrix();
}

/** Hide a calibrated piece if its rotated bounds leave the photograph; never clamp it onto another body region. */
export function insidePhoto(point:Placement,aspect:number,width:number,height:number) {
  if(![point.x,point.y,point.width,point.rotation,aspect].every(Number.isFinite) || point.width<=0 || aspect<=0)return false;
  const c=Math.cos(point.rotation),s=Math.sin(point.rotation),h=point.width*aspect;
  return [-point.width/2,point.width/2].every(x=>[0,h].every(y=>{
    const px=point.x+x*c-y*s,py=point.y+x*s+y*c;
    return px>=0 && py>=0 && px<=width && py<=height;
  }));
}

/** Also disposes resources that finish loading after cancellation. */
export class RenderLifetime {
  private closed=false;
  private cleanups:Array<()=>void>=[];
  add(cleanup:()=>void){if(this.closed)cleanup();else this.cleanups.push(cleanup);}
  close(){if(this.closed)return;this.closed=true;for(const cleanup of this.cleanups.splice(0).reverse()){try{cleanup();}catch{/* Continue releasing the remaining resources. */}}}
}

/** Serializes initialization and cancellation for components sharing a canvas. */
export class RenderSessions<Key extends object> {
  private sessions=new WeakMap<Key,{controller:AbortController;started:Promise<void>}>();
  run(key:Key,external:AbortSignal,start:(signal:AbortSignal)=>Promise<void>) {
    const previous=this.sessions.get(key);previous?.controller.abort();
    const controller=new AbortController();
    const abort=()=>controller.abort();
    external.addEventListener('abort',abort,{once:true});
    controller.signal.addEventListener('abort',()=>external.removeEventListener('abort',abort),{once:true});
    if(external.aborted)controller.abort();
    const started=(async()=>{
      await previous?.started.catch(()=>{});
      controller.signal.throwIfAborted();
      try{await start(controller.signal);}catch(error){controller.abort();throw error;}
    })();
    this.sessions.set(key,{controller,started});
    return started;
  }
}
