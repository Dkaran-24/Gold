// Executes the actual browser renderer with deterministic landmark/WebGL adapters.
// No camera, personal photo, database or external provider is involved.
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({face:[] as Array<{x:number;y:number}>,pose:[] as Array<{x:number;y:number}>,faceClose:vi.fn(),poseClose:vi.fn(),dispose:vi.fn(),clear:vi.fn(),render:vi.fn(),load:vi.fn(),frames:new Map<number,FrameRequestCallback>(),counter:0}));
vi.mock('@mediapipe/tasks-vision',()=>({
  FilesetResolver:{forVisionTasks:async()=>({})},
  FaceLandmarker:{createFromOptions:async()=>({detect:()=>({faceLandmarks:[state.face]}),close:state.faceClose})},
  PoseLandmarker:{createFromOptions:async()=>({detect:()=>({landmarks:[state.pose],close:vi.fn()}),close:state.poseClose})},
}));
vi.mock('three',async importOriginal=>{
  const actual=await importOriginal<typeof import('three')>();
  return {...actual,WebGLRenderer:class{
    canvas:HTMLCanvasElement;constructor({canvas}:{canvas:HTMLCanvasElement}){this.canvas=canvas;}
    setPixelRatio(){} setClearColor(){} setSize(w:number,h:number){this.canvas.width=w;this.canvas.height=h;}
    render=state.render;dispose=state.dispose;clear=state.clear;
  },TextureLoader:class{loadAsync=state.load;}};
});
import {trackJewellery} from '../../../../web/src/lib/try-on/renderer';
import {Vector3,type Scene,type OrthographicCamera,type Sprite} from 'three';
const asset={kind:'NECKLACE' as const,format:'image2d' as const,url:'fixture-only',scale:1,offsetX:0,offsetY:0,rotation:0};
function frame(){const [id,fn]=state.frames.entries().next().value!;state.frames.delete(id);fn(1000);}
beforeEach(()=>{
  vi.clearAllMocks();state.frames.clear();state.face=[];state.pose=[];
  state.face[234]={x:.3,y:.3};state.face[454]={x:.7,y:.3};state.face[152]={x:.5,y:.5};state.pose[11]={x:.1,y:.65};state.pose[12]={x:.9,y:.65};
  state.load.mockResolvedValue({image:{naturalWidth:200,naturalHeight:100},dispose:vi.fn()});
  vi.stubGlobal('HTMLVideoElement',class{});
  vi.stubGlobal('document',{createElement:()=>({width:8,height:8,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(8*8*4).fill(160)})})})});
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{const id=++state.counter;state.frames.set(id,fn);return id;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>state.frames.delete(id));
});
afterEach(()=>vi.unstubAllGlobals());
describe('actual renderer lifecycle with deterministic adapters',()=>{
  it('renders within the pixel viewport on first fitting and repeated identical-size photo/product resets',async()=>{
    const canvas={width:640,height:480} as HTMLCanvasElement;
    const signals:AbortController[]=[];
    for(let attempt=0;attempt<4;attempt++){
      const control=new AbortController();signals.push(control);const report=vi.fn();
      await trackJewellery({width:640,height:480} as HTMLCanvasElement,canvas,{...asset,url:'fixture-'+attempt},control.signal,report,vi.fn());frame();
      const [scene,camera]=state.render.mock.calls.at(-1)! as [Scene,OrthographicCamera];
      const sprite=scene.children[0] as Sprite;expect(sprite.visible).toBe(true);
      camera.updateMatrixWorld();const point=sprite.position.clone().project(camera);
      expect(Math.abs(point.x)).toBeLessThanOrEqual(1);expect(Math.abs(point.y)).toBeLessThanOrEqual(1);
      expect(new Vector3(320,240,0).project(camera).x).toBeCloseTo(0);
      expect(report).toHaveBeenLastCalledWith('Jewellery preview ready');
      expect(state.frames.size).toBe(0);
    }
    signals.at(-1)!.abort();expect(state.faceClose).toHaveBeenCalledTimes(4);expect(state.poseClose).toHaveBeenCalledTimes(4);expect(state.dispose).toHaveBeenCalledTimes(4);
  });
  it('hides the jewellery with clear guidance when face or shoulders are missing',async()=>{
    for(const missing of ['face','shoulders']){
      if(missing==='face')state.face=[];
      else {state.face[234]={x:.3,y:.3};state.face[454]={x:.7,y:.3};state.face[152]={x:.5,y:.5};state.pose=[];}
      const control=new AbortController(),report=vi.fn();
      await trackJewellery({width:640,height:480} as HTMLCanvasElement,{} as HTMLCanvasElement,asset,control.signal,report,vi.fn());frame();
      expect((state.render.mock.calls.at(-1)![0] as Scene).children.every(s=>!s.visible)).toBe(true);
      expect(report.mock.calls.at(-1)![0]).toMatch(missing==='face'?/front-facing/:/shoulders/);control.abort();
    }
  });
  it('failed texture loading releases models and WebGL without creating an animation loop',async()=>{
    state.load.mockRejectedValue(new Error('texture missing'));
    await expect(trackJewellery({width:640,height:480} as HTMLCanvasElement,{} as HTMLCanvasElement,asset,new AbortController().signal,vi.fn(),vi.fn())).rejects.toThrow('texture missing');
    expect(state.faceClose).toHaveBeenCalledOnce();expect(state.poseClose).toHaveBeenCalledOnce();expect(state.dispose).toHaveBeenCalledOnce();expect(state.frames.size).toBe(0);
  });
});
