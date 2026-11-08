import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraError, openCamera, stopTracks } from '../src/lib/try-on/camera.ts';
import { displayTransform, placements, smooth, type Landmark } from '../src/lib/try-on/tracking.ts';
import type { OverlayAsset } from '../src/lib/try-on/types.ts';

const overlay: OverlayAsset = {
  format:'image2d', kind:'EARRINGS', url:'https://example.invalid/test-overlay.png',
  scale:1, offsetX:0, offsetY:0, rotation:0,
};
function trackedFace() {
  const points: Landmark[] = [];
  points[234] = {x:0.3,y:0.3};
  points[454] = {x:0.7,y:0.3};
  points[152] = {x:0.5,y:0.65};
  return points;
}
function streamFixture() {
  let stopped = 0;
  const stream = {getTracks:()=>[{stop:()=>stopped++},{stop:()=>stopped++}]} as unknown as MediaStream;
  return {stream,stopped:()=>stopped};
}
test('unsupported/insecure contexts do not request permission', async () => {
  const controller = new AbortController();
  await assert.rejects(openCamera(undefined, true, true, controller.signal));
  let attempts = 0;
  await assert.rejects(openCamera({getUserMedia:async()=>{attempts++;return streamFixture().stream;}},false,true,controller.signal));
  assert.equal(attempts,0);
});
test('camera opens video only and releases every track on stop',async()=>{
  const fixture=streamFixture();
  let constraints: MediaStreamConstraints|undefined;
  const stream=await openCamera({getUserMedia:async options=>{constraints=options;return fixture.stream;}},true,true,new AbortController().signal);
  assert.equal(constraints?.audio,false);
  assert.deepEqual((constraints?.video as MediaTrackConstraints).facingMode,{ideal:'user'});
  stopTracks(stream);
  assert.equal(fixture.stopped(),2);
});
test('rear camera request sets environment facing mode',async()=>{
  const fixture=streamFixture();
  await openCamera({getUserMedia:async options=>{assert.deepEqual((options?.video as MediaTrackConstraints).facingMode,{ideal:'environment'});return fixture.stream;}},true,false,new AbortController().signal);
});
test('permission denial produces a recoverable instruction',async()=>{
  const denied=new DOMException('no','NotAllowedError');
  await assert.rejects(openCamera({getUserMedia:async()=>{throw denied;}},true,true,new AbortController().signal),denied);
  assert.match(cameraError(denied),/permission|denied/i);
});
test('stopping during permission prompt releases a late stream',async()=>{
  const controller=new AbortController();
  const fixture=streamFixture();
  let resolve!: (stream:MediaStream)=>void;
  const pending=openCamera({getUserMedia:()=>new Promise(done=>{resolve=done;})},true,true,controller.signal);
  controller.abort(); resolve(fixture.stream);
  await assert.rejects(pending,{name:'AbortError'}); assert.equal(fixture.stopped(),2);
});
test('earrings use two independent face anchors and scale with image dimensions',()=>{
  const pair=placements(trackedFace(),[],overlay,1000,1000);
  assert.equal(pair.length,2);
  assert.ok(pair[0]!.x<pair[1]!.x);
  assert.equal(pair[0]!.y,pair[1]!.y);
  const reduced=placements(trackedFace(),[],overlay,500,500);
  assert.equal(reduced[0]!.width,pair[0]!.width/2);
});
test('calibration translates, scales and rotates the actual selected overlay',()=>{
  const base=placements(trackedFace(),[],overlay,1000,1000)[0]!;
  const calibrated=placements(trackedFace(),[],{...overlay,scale:2,rotation:90,offsetX:0.1,offsetY:0.2},1000,1000)[0]!;
  assert.equal(calibrated.width,base.width*2);
  assert.equal(calibrated.rotation,Math.PI/2);
  assert.ok(calibrated.x>base.x && calibrated.y>base.y);
});
test('necklace combines chin, shoulder midpoint and shoulder span',()=>{
  const pose:Landmark[]=[];
  pose[11]={x:0.1,y:0.8};pose[12]={x:0.9,y:0.85};
  const result=placements(trackedFace(),pose,{...overlay,kind:'NECKLACE'},1000,1000);
  assert.equal(result.length,1);assert.equal(result[0]!.x,500);
  assert.ok(result[0]!.y>650 && result[0]!.y<850);
  assert.ok(result[0]!.rotation>0);
  pose[12].visibility=0.2;
  assert.equal(placements(trackedFace(),pose,{...overlay,kind:'NECKLACE'},1000,1000).length,0);
});
test('missing or invalid face landmarks never leave a spurious overlay',()=>{
  assert.deepEqual(placements([],[],overlay,600,400),[]);
  const face=trackedFace();face[152]!.x=NaN;
  assert.deepEqual(placements(face,[],overlay,600,400),[]);
});
test('front display mirrors both layers together; back camera retains source coordinates',()=>{
  assert.equal(displayTransform(true),'scaleX(-1)');
  assert.equal(displayTransform(false),'none');
});
test('smoothing dampens small movements and resets after tracking loss',()=>{
  const first={x:100,y:100,rotation:0,width:30}, next={...first,x:120};
  const damped=smooth(first,next,50);
  assert.ok(damped.x>100 && damped.x<120);
  assert.equal(smooth(first,next,500),next);
});

