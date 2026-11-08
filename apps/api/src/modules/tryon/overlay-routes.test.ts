import {describe,it,expect,vi} from 'vitest';
import request from 'supertest';
import {pino} from 'pino';
import type {PrismaClient} from '@showroom/database';
import {createApp} from '../../app.js';
import {readConfig} from '../../config.js';

function fixture(){
  const db={session:{findUnique:vi.fn().mockResolvedValue({userId:'owner',expiresAt:new Date(Date.now()+60000),user:{ownerSlot:1}})},product:{findFirst:vi.fn().mockResolvedValue({id:'piece'})},tryOnOverlay:{findUnique:vi.fn().mockResolvedValue(null)}};
  const config=readConfig({NODE_ENV:'test',DATABASE_URL:'postgresql://unused@localhost/unused'});
  const storage={ready:vi.fn(),upload:vi.fn(),destroy:vi.fn()};
  return {db,config,storage,app:createApp(db as unknown as PrismaClient,config,pino({enabled:false}),storage)};
}
const path='/api/admin/products/piece/try-on/overlay',cookie='showroom_session='+'a'.repeat(64);
describe('overlay endpoint authorization and migration readiness',()=>{
  it('rejects unauthenticated reads and writes before touching storage',async()=>{
    const {app,config,storage}=fixture();
    await request(app).get(path).expect(401);
    await request(app).post(path).set('Origin',config.WEB_ORIGIN).set('Content-Type','image/png').send(Buffer.from('test')).expect(401);
    await request(app).delete(path).set('Origin',config.WEB_ORIGIN).send({confirm:true}).expect(401);
    expect(storage.upload).not.toHaveBeenCalled();
  });
  it('rejects cross-origin uploads even with an owner cookie',async()=>{
    const {app,db}=fixture();await request(app).post(path).set('Cookie',cookie).set('Origin','https://other.example').send({}).expect(403);expect(db.session.findUnique).not.toHaveBeenCalled();
  });
  it('returns a specific migration-pending notice rather than a fake overlay',async()=>{
    const {app,db}=fixture();db.tryOnOverlay.findUnique.mockRejectedValue({code:'P2021'});
    const result=await request(app).get(path).set('Cookie',cookie).expect(503);
    expect(result.body.error.code).toBe('OVERLAY_SCHEMA_PENDING');
  });
  it('requires actual-product confirmation and PNG content before upload',async()=>{
    const {app,config,storage}=fixture();
    await request(app).post(path+'?kind=NECKLACE').set('Cookie',cookie).set('Origin',config.WEB_ORIGIN).send({}).expect(422);
    await request(app).post(path+'?kind=NECKLACE&representsActualProduct=true').set('Cookie',cookie).set('Origin',config.WEB_ORIGIN).set('Content-Type','image/jpeg').send(Buffer.from('not png')).expect(415);
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
