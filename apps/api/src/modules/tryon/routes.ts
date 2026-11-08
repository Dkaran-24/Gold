import { randomBytes } from 'node:crypto';
import express, { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { PrismaClient } from '@showroom/database';
import { digest, requireOwner } from '../../auth.js';
import type { Config } from '../../config.js';
import { ApiError } from '../../errors.js';
import { id } from '../catalogue/validation.js';
import { audit, publicWhere, publicSelect, publicDto } from '../catalogue/service.js';
import { assetInput, consentVersion, defaultAsset, productConfig, settings, settingsInput } from './settings.js';
import { jobDto, type TryOnRuntime, verifyGrant } from './runtime.js';
import { cloudinaryStorage, type ImageStorage } from '../images/cloudinary.js';
import { Overlays, overlayLimit, validateOverlay } from './overlay.js';

const cookie = 'showroom_tryon_guest';
function guestToken(req: Request) {
  const token: unknown = req.cookies?.[cookie];
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function ownerHash(req: Request) {
  const token = guestToken(req);
  if (!token) throw new ApiError(404,'NOT_FOUND','Preview unavailable or expired.');
  return digest(token);
}
function issueGuest(req: Request,res: Response,config: Config) {
  res.cookie(cookie,guestToken(req) ?? randomBytes(32).toString('hex'),{
    httpOnly:true, secure:config.NODE_ENV==='production', sameSite:'strict',path:'/api/try-on',maxAge:72*3600000,
  });
}
const emptyBody = z.object({}).strict();
const createInput = z.object({
  productId:id, consent:z.literal('true'), consentVersion:z.literal(consentVersion),
}).strict();
const missingProduct = () => new ApiError(404,'NOT_FOUND','Product unavailable.');
export function tryOnRoutes(db: PrismaClient,config: Config,runtime: TryOnRuntime,storage:ImageStorage=cloudinaryStorage()) {
  const routes = Router();
  const owner = requireOwner(db);
  const overlays=new Overlays(db,storage);
  const limited = rateLimit({
    windowMs:15*60_000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:{code:'RATE_LIMITED',message:'Too many preview requests. Please try again later.'}},
  });
  const providerStatus = () => ({providerConfigured:runtime.provider.configured,model:runtime.provider.model});
  routes.use(['/try-on','/admin/try-on','/admin/products/:id/try-on'],(_req,res,next) => {
    res.set('Cache-Control','private, no-store');
    next();
  });

  routes.get('/try-on/products/:id/config', async (req,res) => {
    const configData = await productConfig(db,id.parse(req.params.id));
    issueGuest(req,res,config);
    res.json({data:{...configData.public,providerConfigured:runtime.provider.configured}});
  });
  routes.get('/try-on/products', async (_req,res) => {
    const cfg = await settings(db);
    const rows = await db.product.findMany({
      where:{...publicWhere,categoryId:{in:cfg.eligibleCategoryIds},tryOnAsset:{enabled:true}},
      orderBy:[{name:'asc'},{id:'asc'}],
      select:{id:true,name:true,sku:true,slug:true,_count:{select:{images:true}},
        tryOnAsset:{select:{kind:true,dedicatedOverlay:true}}},
    });
    const data = rows.filter(p => {
      const overlay = p.tryOnAsset?.dedicatedOverlay;
      return cfg.photoEnabled && p._count.images>0 ||
        cfg.arEnabled && overlay?.productId === p.id && overlay.kind===p.tryOnAsset?.kind && overlay.format==='png';
    }).map(({id,name,sku,slug})=>({id,name,sku,slug}));
    res.json({data});
  });
  // Local studio: only published products with their own enabled, calibrated overlay.
  routes.get('/try-on/studio-products', async (req,res) => {
    const {page} = z.object({page:z.coerce.number().int().min(1).max(10000).default(1)}).parse(req.query);
    const cfg = await settings(db);
    if (!cfg.arEnabled) { res.json({data:[],hasMore:false}); return; }
    const rows = await db.product.findMany({
      where:{...publicWhere,categoryId:{in:cfg.eligibleCategoryIds},tryOnAsset:{enabled:true,dedicatedOverlay:{isNot:null}}},
      orderBy:[{name:'asc'},{id:'asc'}], skip:(page-1)*24,take:25,
      select:{...publicSelect,tryOnAsset:{include:{dedicatedOverlay:true}}},
    });
    const data = rows.slice(0,24).flatMap(({tryOnAsset:asset,...product}) => {
      const image=asset?.dedicatedOverlay;
      if (!asset || image?.productId!==product.id || image.kind!==asset.kind || image.format!=='png') return [];
      return [{product:publicDto(product),asset:{format:'image2d',kind:asset.kind,url:image.url,
        scale:asset.scale,offsetX:asset.offsetX,offsetY:asset.offsetY,rotation:asset.rotation}}];
    });
    res.json({data,hasMore:rows.length>24});
  });
  routes.post('/try-on/photo', limited, async (req,res,next) => {
    const {productId} = createInput.parse(req.query);
    ownerHash(req);
    z.uuid().parse(req.get('idempotency-key'));
    if (!req.is(['image/png','image/webp','image/jpeg'])) throw new ApiError(415,'UNSUPPORTED_IMAGE','Choose a JPEG, PNG or WebP photograph.');
    const cfg = await productConfig(db,productId);
    if (!cfg.public.photoEnabled) throw new ApiError(409,'PRODUCT_INELIGIBLE','Photo try-on is unavailable for this piece.');
    if (!runtime.provider.configured) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','Photo try-on needs showroom provider configuration.');
    express.raw({type:['image/png','image/webp','image/jpeg'],limit:cfg.public.maxUploadMb*1048576,inflate:false})(req,res,next);
  }, async (req,res) => {
    const { productId } = createInput.parse(req.query);
    const mime = req.get('content-type')!.split(';')[0]!.toLowerCase();
    const job = await runtime.create(ownerHash(req),z.uuid().parse(req.get('idempotency-key')),productId,req.body,mime);
    res.status(202).json({data:jobDto(job)});
  });
  routes.get('/try-on/jobs/:id', async (req,res) => {
    const job = await runtime.owned(z.uuid().parse(req.params.id),ownerHash(req));
    res.json({data:jobDto(job)});
  });
  routes.post('/try-on/jobs/:id/retry', limited, async (req,res) => {
    emptyBody.parse(req.body ?? {});
    const job = await runtime.retry(z.uuid().parse(req.params.id),ownerHash(req));
    res.status(202).json({data:jobDto(job)});
  });
  routes.delete('/try-on/jobs/:id', async (req,res) => {
    emptyBody.parse(req.body ?? {});
    await runtime.discard(await runtime.owned(z.uuid().parse(req.params.id),ownerHash(req)));
    res.status(204).end();
  });
  routes.get('/try-on/jobs/:id/result', async (req,res) => {
    const job = await runtime.owned(z.uuid().parse(req.params.id),ownerHash(req));
    const q = z.object({until:z.coerce.number().int().positive(),signature:z.string().max(128)}).strict().parse(req.query);
    verifyGrant(job,q.until,q.signature);
    const bytes = await runtime.result(job);
    res.set('Referrer-Policy','no-referrer').type(job.resultMime!).send(bytes);
  });
  routes.get('/admin/try-on/settings', owner, async (_req,res) => {
    res.json({data:{...await settings(db),...providerStatus()}});
  });
  routes.patch('/admin/try-on/settings',owner,async (req,res) => {
    const patch = settingsInput.partial().refine(v=>Object.keys(v).length>0).parse(req.body);
    const saved = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(768510332)`;
      const previous = await settings(tx);
      const {eligibleCategoryIds,...values} = settingsInput.parse({...previous,...patch});
      if (eligibleCategoryIds.length !== await tx.category.count({where:{id:{in:eligibleCategoryIds}}})) {
        throw new ApiError(422,'INVALID_CATEGORY','Choose existing catalogue categories.');
      }
      const ids = eligibleCategoryIds.map(id=>({id}));
      await tx.tryOnConfiguration.upsert({where:{id:1},
        create:{id:1,...values,eligibleCategories:{connect:ids}},update:{...values,eligibleCategories:{set:ids}},
      });
      await audit(tx,res.locals.ownerId,'TRYON_SETTINGS','TryOnConfiguration','1');
      return settings(tx);
    });
    res.json({data:{...saved,...providerStatus()}});
  });
  routes.get('/admin/try-on/analytics',owner,async (_req,res) => {
    const groups = await db.tryOnUsage.groupBy({by:['status'],_count:true});
    const counts = new Map(groups.map(g=>[g.status,g._count]));
    res.json({data:{total:groups.reduce((n,g)=>n+g._count,0),succeeded:counts.get('COMPLETED')??0,
      failed:counts.get('FAILED')??0,queued:counts.get('QUEUED')??0,processing:counts.get('PROCESSING')??0}});
  });
  routes.get('/admin/products/:id/try-on',owner,async (req,res) => {
    const p = await db.product.findFirst({where:{id:id.parse(req.params.id),deletedAt:null},include:{tryOnAsset:true}});
    if (!p) throw missingProduct();
    res.json({data:assetInput.parse(p.tryOnAsset ? projectAsset(p.tryOnAsset) : defaultAsset)});
  });
  routes.get('/admin/products/:id/try-on/overlay',owner,async(req,res)=>{
    const productId=id.parse(req.params.id);
    if(!await db.product.findFirst({where:{id:productId,deletedAt:null}}))throw missingProduct();
    try {res.json({data:await db.tryOnOverlay.findUnique({where:{productId}})});}
    catch(error){
      if(error && typeof error==='object' && 'code' in error && error.code==='P2021')throw new ApiError(503,'OVERLAY_SCHEMA_PENDING','Separate overlay storage is not available yet. The reviewed database migration must be approved and applied before uploads.');
      throw error;
    }
  });
  routes.post('/admin/products/:id/try-on/overlay',owner,limited,
    express.raw({type:'image/png',limit:overlayLimit,inflate:false}),async(req,res)=>{
      const query=z.object({kind:z.enum(['NECKLACE','EARRINGS']),expectedPublicId:z.string().max(300).default(''),representsActualProduct:z.literal('true')}).strict().parse(req.query);
      const file=await validateOverlay(req.body,req.get('content-type')?.split(';')[0]??'');
      const saved=await overlays.upload(id.parse(req.params.id),res.locals.ownerId,query.kind,query.expectedPublicId||null,file);
      res.status(201).json({data:saved});
    });
  routes.delete('/admin/products/:id/try-on/overlay',owner,limited,async(req,res)=>{
    const body=z.object({confirm:z.literal(true),expectedPublicId:z.string().min(1).max(300)}).strict().parse(req.body);
    await overlays.remove(id.parse(req.params.id),res.locals.ownerId,body.expectedPublicId);
    res.json({data:{detached:true,cleanup:'queued'}});
  });
  routes.patch('/admin/products/:id/try-on',owner,async (req,res) => {
    const productId=id.parse(req.params.id);
    const patch = assetInput.partial().refine(v=>Object.keys(v).length>0).parse(req.body);
    const saved = await db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      const p=await tx.product.findFirst({where:{id:productId,deletedAt:null},include:{tryOnAsset:true}});
      if (!p) throw missingProduct();
      const values = assetInput.parse({...p.tryOnAsset?projectAsset(p.tryOnAsset):defaultAsset,...patch});
      if (values.overlayImageId && !await tx.productImage.count({where:{id:values.overlayImageId,productId,format:{in:['png','webp']}}})) {
        throw new ApiError(422,'INVALID_OVERLAY','Choose a PNG or WebP overlay from this product’s own gallery.');
      }
      await tx.productTryOnAsset.upsert({where:{productId},create:{productId,...values},update:values});
      await audit(tx,res.locals.ownerId,'TRYON_PRODUCT','Product',productId);
      return values;
    });
    res.json({data:saved});
  });
  return routes;
}
function projectAsset({enabled,kind,overlayImageId,scale,offsetX,offsetY,rotation}: z.infer<typeof assetInput>) {
  return {enabled,kind,overlayImageId,scale,offsetX,offsetY,rotation};
}
