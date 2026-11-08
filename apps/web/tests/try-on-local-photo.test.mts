import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhotoFile, photoSize, decodePhoto, inspectPhoto } from '../src/lib/try-on/photo.ts';

test('local upload rejects unsupported types, empty and oversized files',()=>{
  for(const type of ['image/svg+xml','text/html','image/gif','']) assert.throws(()=>validatePhotoFile({type,size:100}));
  for(const size of [0,10*1024*1024+1]) assert.throws(()=>validatePhotoFile({type:'image/jpeg',size}));
  for(const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(()=>validatePhotoFile({type,size:1024}));
});
test('portrait dimensions are bounded and downsampling preserves proportions',()=>{
  assert.deepEqual(photoSize(3000,4000),{width:1200,height:1600});
  assert.deepEqual(photoSize(600,400),{width:600,height:400});
  for(const [w,h] of [[255,500],[6000,6000],[10001,256],[NaN,500],[Infinity,500]]) assert.throws(()=>photoSize(w!,h!));
});
test('spoofed upload MIME is rejected before browser image decoding',async()=>{
  for(const type of ['image/jpeg','image/png','image/webp']) {
    await assert.rejects(decodePhoto(new File(['<svg onload="bad()"/>'],'photo',{type})),/not a valid/);
  }
});
test('oversized raster headers are rejected before decoding allocates pixels',()=>{
  const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);
  const view=new DataView(bytes.buffer);view.setUint32(16,640);view.setUint32(20,480);
  assert.deepEqual(inspectPhoto(bytes,'image/png'),{width:640,height:480});
  view.setUint32(16,100000);view.setUint32(20,100000);
  assert.throws(()=>inspectPhoto(bytes,'image/png'),/25 megapixels/);
});
