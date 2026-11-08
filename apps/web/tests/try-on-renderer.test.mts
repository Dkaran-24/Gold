import test from 'node:test';
import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3} from 'three';
import {pixelViewport,insidePhoto,RenderLifetime,RenderSessions} from '../src/lib/try-on/render-state.ts';

test('first fitting, reset, same-sized photo replacement and product changes initialize independent pixel cameras',()=>{
  const reusedCanvas={width:640,height:480};
  for(const attempt of ['first','reset','same-size replacement','product change','reselection']) {
    const camera=new OrthographicCamera(0,1,1,0,.1,10);camera.position.z=1;
    pixelViewport(camera,reusedCanvas.width,reusedCanvas.height);camera.updateMatrixWorld();
    const center=new Vector3(320,240,0).project(camera);
    assert.ok(Math.abs(center.x)<1e-10 && Math.abs(center.y)<1e-10,attempt);
    const bottomRight=new Vector3(640,0,0).project(camera);
    assert.equal(bottomRight.x,1);assert.equal(bottomRight.y,-1);
  }
});
test('camera resizing maps new portrait and landscape coordinates without stale bounds',()=>{
  const camera=new OrthographicCamera();camera.position.z=1;camera.updateMatrixWorld();
  for(const [w,h] of [[640,480],[480,640],[1600,1200],[360,800]]) {
    pixelViewport(camera,w!,h!);
    const p=new Vector3(w!/2,h!/2,0).project(camera);
    assert.ok(Math.abs(p.x)<1e-10 && Math.abs(p.y)<1e-10);
  }
});
test('rotated overlay bounds stay inside the portrait or are hidden, never relocated',()=>{
  const p={x:320,y:240,width:150,rotation:0};
  assert.equal(insidePhoto(p,.6,640,480),true);
  assert.equal(insidePhoto({...p,x:10},.6,640,480),false);
  assert.equal(insidePhoto({...p,y:470},.6,640,480),false);
  assert.equal(insidePhoto({...p,rotation:Math.PI/2},.6,640,480),true);
  assert.equal(insidePhoto({...p,width:NaN},.6,640,480),false);
});
test('cleanup is exactly once, includes late resources, and continues after a failed disposer',()=>{
  const lifetime=new RenderLifetime(),closed:string[]=[];
  lifetime.add(()=>closed.push('model'));lifetime.add(()=>{closed.push('texture');throw new Error('test');});
  lifetime.add(()=>closed.push('frame'));
  lifetime.close();lifetime.close();lifetime.add(()=>closed.push('late model'));
  assert.deepEqual(closed,['frame','texture','model','late model']);
});
test('restarts cancel old sessions and await delayed initialization before touching the shared canvas',async()=>{
  const sessions=new RenderSessions<object>(),canvas={},events:string[]=[];
  let release!:()=>void;
  const first=sessions.run(canvas,new AbortController().signal,async signal=>{
    events.push('first start');signal.addEventListener('abort',()=>events.push('first stopped'));
    await new Promise<void>(done=>release=done);events.push('first released');signal.throwIfAborted();
  });
  await Promise.resolve();
  const controller=new AbortController();
  const second=sessions.run(canvas,controller.signal,async signal=>{events.push('second start');signal.addEventListener('abort',()=>events.push('second stopped'));});
  const failed=assert.rejects(first,{name:'AbortError'});
  assert.deepEqual(events,['first start','first stopped']);release();await failed;await second;controller.abort();
  assert.deepEqual(events,['first start','first stopped','first released','second start','second stopped']);
});
test('cancelled sessions never initialize models or textures',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(new RenderSessions<object>().run({},controller.signal,async()=>{assert.fail('initialized');}),{name:'AbortError'});
});
