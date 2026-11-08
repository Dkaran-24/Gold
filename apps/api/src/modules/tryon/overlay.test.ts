import {describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {pino} from 'pino';
import type {PrismaClient} from '@showroom/database';
import {Overlays,validateOverlay,overlayPrefix} from './overlay.js';
import {Images} from '../images/service.js';

async function png(mode:'cutout'|'opaque'|'empty'|'token'='cutout') {
  const bytes=Buffer.alloc(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++) {
    const i=(y*64+x)*4;bytes[i]=230;bytes[i+1]=180;bytes[i+2]=80;
    bytes[i+3]=mode==='empty'?0:mode==='opaque'?255:mode==='token'?(x===0&&y===0?0:255):(x>=16&&x<48&&y>=16&&y<48?255:0);
  }
  return sharp(bytes,{raw:{width:64,height:64,channels:4}}).png().toBuffer();
}
const oldId=overlayPrefix('piece')+'11111111-1111-4111-8111-111111111111';
function fixture(previous:object|null=null) {
  const tx={
    $queryRaw:vi.fn().mockResolvedValue([{id:'piece'}]),
    product:{findFirst:vi.fn().mockResolvedValue({id:'piece',tryOnAsset:{kind:'NECKLACE'}})},
    tryOnOverlay:{findUnique:vi.fn().mockResolvedValue(previous),upsert:vi.fn().mockImplementation(async({create})=>create),delete:vi.fn()},
    productImage:{findUnique:vi.fn().mockResolvedValue(null)},
    imageCleanup:{create:vi.fn(),delete:vi.fn(),upsert:vi.fn(),updateMany:vi.fn().mockResolvedValue({count:1}),findMany:vi.fn().mockResolvedValue([])},
    auditLog:{create:vi.fn()},
  };
  const db={...tx,$transaction:vi.fn(async(fn:Function)=>fn(tx))};
  const storage={ready:vi.fn(),upload:vi.fn().mockResolvedValue({url:'https://res.cloudinary.com/test/overlay.png'}),destroy:vi.fn()};
  return {tx,db,storage,service:new Overlays(db as unknown as PrismaClient,storage)};
}
describe('transparent PNG validation',()=>{
  it('accepts a real cutout and preserves alpha through sanitization',async()=>{
    const file=await validateOverlay(await png(),'image/png');
    expect((await sharp(file.buffer).metadata()).hasAlpha).toBe(true);expect((await sharp(file.buffer).stats()).isOpaque).toBe(false);
  });
  it('rejects opaque RGB/RGBA, empty and token-transparency images',async()=>{
    for(const mode of ['opaque','empty','token'] as const)await expect(validateOverlay(await png(mode),'image/png')).rejects.toMatchObject({code:'TRANSPARENT_CUTOUT_REQUIRED'});
    const rgb=await sharp(await png('opaque')).removeAlpha().png().toBuffer();
    await expect(validateOverlay(rgb,'image/png')).rejects.toMatchObject({code:'TRANSPARENT_CUTOUT_REQUIRED'});
  });
  it('rejects mislabeled, non-PNG and oversized inputs',async()=>{
    await expect(validateOverlay(await png(),'image/jpeg')).rejects.toMatchObject({status:415});
    await expect(validateOverlay(Buffer.from('<svg/>'),'image/png')).rejects.toMatchObject({status:422});
    await expect(validateOverlay(Buffer.alloc(5*1024*1024+1),'image/png')).rejects.toMatchObject({status:413});
  });
});
describe('separate overlay lifecycle (in-memory database and storage doubles only)',()=>{
  it('reserves cleanup before upload and attaches without touching gallery/configuration records',async()=>{
    const {service,tx,storage}=fixture();
    await service.upload('piece','owner','NECKLACE',null,await validateOverlay(await png(),'image/png'));
    expect(tx.imageCleanup.create.mock.invocationCallOrder[0]).toBeLessThan(storage.upload.mock.invocationCallOrder[0]!);
    expect(storage.upload.mock.calls[0]![0]).toMatch(/^showroom\/try-on-overlays\/piece\//);
    expect(tx.tryOnOverlay.upsert).toHaveBeenCalledOnce();expect(tx.productImage.findUnique).not.toHaveBeenCalled();
  });
  it('queues only the replaced overlay and keeps the old gallery reference out of the operation',async()=>{
    const {service,tx}=fixture({publicId:oldId});
    await service.upload('piece','owner','NECKLACE',oldId,await validateOverlay(await png(),'image/png'));
    expect(tx.imageCleanup.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{publicId:oldId}}));
  });
  it('rejects a type mismatch or stale replacement before uploading',async()=>{
    const {service,storage}=fixture({publicId:oldId});const file=await validateOverlay(await png(),'image/png');
    await expect(service.upload('piece','owner','EARRINGS',oldId,file)).rejects.toMatchObject({code:'KIND_MISMATCH'});
    await expect(service.upload('piece','owner','NECKLACE',null,file)).rejects.toMatchObject({code:'OVERLAY_CHANGED'});
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('retains durable cleanup after upload or uncertain attachment failure; never destroys directly',async()=>{
    const {service,storage,tx}=fixture();tx.tryOnOverlay.upsert.mockRejectedValue(new Error('uncertain commit'));
    await expect(service.upload('piece','owner','NECKLACE',null,await validateOverlay(await png(),'image/png'))).rejects.toThrow('uncertain commit');
    expect(tx.imageCleanup.updateMany).toHaveBeenCalled();expect(storage.destroy).not.toHaveBeenCalled();
  });
  it('removal detaches only the dedicated overlay and queues remote cleanup',async()=>{
    const {service,tx,storage}=fixture({publicId:oldId});await service.remove('piece','owner',oldId);
    expect(tx.tryOnOverlay.delete).toHaveBeenCalledWith({where:{productId:'piece'}});expect(tx.imageCleanup.upsert).toHaveBeenCalled();expect(storage.destroy).not.toHaveBeenCalled();
  });
  it('cleanup protects an attached overlay after an uncertain commit',async()=>{
    const {db,tx,storage}=fixture({publicId:oldId});tx.imageCleanup.findMany.mockResolvedValue([{publicId:oldId,productId:'piece',attempts:0}] as never);
    await new Images(db as unknown as PrismaClient,storage,pino({enabled:false}),10).cleanup();
    expect(storage.destroy).not.toHaveBeenCalled();expect(tx.imageCleanup.delete).toHaveBeenCalled();
  });
  it('cleanup destroys only unreferenced managed overlay assets',async()=>{
    const {db,tx,storage}=fixture();tx.imageCleanup.findMany.mockResolvedValue([{publicId:oldId,productId:'piece',attempts:0}] as never);
    await new Images(db as unknown as PrismaClient,storage,pino({enabled:false}),10).cleanup();expect(storage.destroy).toHaveBeenCalledWith(oldId);
  });
});

