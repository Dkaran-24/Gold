import { describe,it,expect,vi } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import type { PrismaClient } from '@showroom/database';
import { createApp } from '../../app.js';
import { readConfig } from '../../config.js';

function fixture(enabled=true) {
  const db={tryOnConfiguration:{findUnique:vi.fn().mockResolvedValue({id:1,arEnabled:enabled,eligibleCategories:[{id:'category'}]})},product:{findMany:vi.fn().mockResolvedValue([])}};
  const app=createApp(db as unknown as PrismaClient,readConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused@localhost/unused'}),pino({enabled:false}));
  return {db,app};
}
describe('local studio public catalogue boundary',()=>{
  it('honours the existing AR switch without reading products',async()=>{
    const {db,app}=fixture(false);const response=await request(app).get('/api/try-on/studio-products');
    expect(response.status).toBe(200);expect(response.body).toEqual({data:[],hasMore:false});expect(db.product.findMany).not.toHaveBeenCalled();
  });
  it('restricts published visible eligible products and bounds pagination',async()=>{
    const {db,app}=fixture();await request(app).get('/api/try-on/studio-products?page=2').expect(200);
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:24,take:25,where:expect.objectContaining({publication:'PUBLISHED',deletedAt:null,category:{visible:true},categoryId:{in:['category']},tryOnAsset:{enabled:true,dedicatedOverlay:{isNot:null}}})}));
    await request(app).get('/api/try-on/studio-products?page=-1').expect(422);
  });
  it('excludes another product’s overlay and strips private fields',async()=>{
    const {db,app}=fixture();
    const product={id:'piece',name:'Fixture',sku:'test',images:[],enquiryOnly:true,publicPrice:999,publicMakingCharge:888,arrivalDate:null,newUntil:null};
    const asset={kind:'EARRINGS',scale:1,offsetX:0,offsetY:0,rotation:0,dedicatedOverlay:{productId:'piece',kind:'EARRINGS',format:'png',url:'https://res.cloudinary.com/test/image.png',publicId:'private-id'}};
    db.product.findMany.mockResolvedValue([{...product,tryOnAsset:asset},{...product,id:'other',tryOnAsset:asset}] as never);
    const response=await request(app).get('/api/try-on/studio-products').expect(200);
    expect(response.body.data).toHaveLength(1);expect(response.body.data[0].product.publicPrice).toBeNull();expect(response.body.data[0].product.publicMakingCharge).toBeNull();
    expect(response.body.data[0].asset.url).toBe(asset.dedicatedOverlay.url);expect(response.text).not.toContain('private-id');expect(response.text).not.toContain('tryOnAsset');
  });
  it('never falls back to a legacy gallery photograph or a differently typed overlay',async()=>{
    const {db,app}=fixture();
    const product={id:'piece',images:[],enquiryOnly:true,publicPrice:null,publicMakingCharge:null};
    db.product.findMany.mockResolvedValue([
      {...product,tryOnAsset:{kind:'NECKLACE',overlayImage:{productId:'piece',format:'png',url:'opaque-bust'},dedicatedOverlay:null}},
      {...product,tryOnAsset:{kind:'NECKLACE',dedicatedOverlay:{productId:'piece',kind:'EARRINGS',format:'png',url:'wrong-kind'}}},
    ] as never);
    const response=await request(app).get('/api/try-on/studio-products').expect(200);
    expect(response.body.data).toEqual([]);
  });
});

