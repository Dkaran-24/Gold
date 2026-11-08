import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { PrismaClient, Prisma, TryOnKind } from '@showroom/database';
import { ApiError } from '../../errors.js';
import { audit } from '../catalogue/service.js';
import type { ImageStorage } from '../images/cloudinary.js';
import { validateImage } from '../images/validation.js';

export const overlayLimit = 5 * 1024 * 1024;
export const overlayPrefix = (productId:string) => `showroom/try-on-overlays/${productId}/`;
export async function validateOverlay(bytes:unknown,mime:string) {
  if(mime!=='image/png')throw new ApiError(415,'PNG_REQUIRED','Choose a transparent PNG cutout of the actual jewellery.');
  const file=await validateImage(bytes,mime,overlayLimit);
  const {data,info}=await sharp(file.buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent=0,visible=0;
  for(let i=3;i<data.length;i+=4){if(data[i]!<=8)transparent++;if(data[i]!>=200)visible++;}
  const pixels=info.width*info.height;
  if(info.width<32 || info.height<32 || transparent/pixels<0.01 || visible/pixels<0.01) {
    throw new ApiError(422,'TRANSPARENT_CUTOUT_REQUIRED','The PNG must contain visible jewellery and a genuinely transparent background (at least 1% each). Opaque photographs and empty images are not accepted.');
  }
  return file;
}

export class Overlays {
  constructor(private db:PrismaClient,private storage:ImageStorage){}
  async upload(productId:string,actorId:string,kind:TryOnKind,expectedPublicId:string|null,file:Awaited<ReturnType<typeof validateOverlay>>) {
    this.storage.ready();
    const publicId=overlayPrefix(productId)+randomUUID();
    const check=async(tx:Prisma.TransactionClient)=>{
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      const product=await tx.product.findFirst({where:{id:productId,deletedAt:null,availability:{not:'ARCHIVED'}},include:{tryOnAsset:true}});
      if(!product)throw new ApiError(404,'NOT_FOUND','Product unavailable.');
      if(!product.tryOnAsset || product.tryOnAsset.kind!==kind)throw new ApiError(409,'KIND_MISMATCH','Save the correct jewellery type in the piece settings before uploading.');
      const previous=await tx.tryOnOverlay.findUnique({where:{productId}});
      if((previous?.publicId??null)!==expectedPublicId)throw new ApiError(409,'OVERLAY_CHANGED','The overlay changed. Refresh this piece before replacing it.');
      return previous;
    };
    // Persist cleanup intent before any external upload; a crash cannot orphan the asset.
    await this.db.$transaction(async tx=>{
      await check(tx);
      await tx.imageCleanup.create({data:{publicId,productId,notBefore:new Date(Date.now()+86400000)}});
    });
    try {
      const remote=await this.storage.upload(publicId,file.buffer);
      return await this.db.$transaction(async tx=>{
        const previous=await check(tx);
        // Claim the intent under its row lock. Cleanup cannot race attachment.
        await tx.imageCleanup.delete({where:{publicId}});
        const data={kind,publicId,url:remote.url,format:'png',width:file.width,height:file.height,bytes:file.bytes,validatedAt:new Date()};
        const saved=await tx.tryOnOverlay.upsert({where:{productId},create:{productId,...data},update:data});
        if(previous)await tx.imageCleanup.upsert({where:{publicId:previous.publicId},create:{publicId:previous.publicId,productId,notBefore:new Date()},update:{notBefore:new Date()}});
        await audit(tx,actorId,'TRYON_OVERLAY_UPLOAD','TryOnOverlay',productId);
        return saved;
      });
    }catch(error){
      // Never destroy directly after an uncertain commit: cleanup checks attachment first.
      await this.db.imageCleanup.updateMany({where:{publicId},data:{notBefore:new Date()}}).catch(()=>{});
      throw error;
    }
  }
  async remove(productId:string,actorId:string,expectedPublicId:string) {
    await this.db.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${productId} FOR UPDATE`;
      const previous=await tx.tryOnOverlay.findUnique({where:{productId}});
      if(!previous || previous.publicId!==expectedPublicId)throw new ApiError(409,'OVERLAY_CHANGED','The overlay changed. Refresh this piece before removing it.');
      await tx.imageCleanup.upsert({where:{publicId:previous.publicId},create:{publicId:previous.publicId,productId,notBefore:new Date()},update:{notBefore:new Date()}});
      await tx.tryOnOverlay.delete({where:{productId}});
      await audit(tx,actorId,'TRYON_OVERLAY_REMOVE','TryOnOverlay',productId);
    });
  }
}

