import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Prisma, PrismaClient, TryOnJob } from '@showroom/database';
import { ApiError } from '../../errors.js';
import { validateImage } from '../images/validation.js';
import { createTryOnProvider, PROMPT_VERSION, type TryOnProvider } from './provider.js';
import { consentVersion, productConfig } from './settings.js';
import { PrivatePhotos } from './storage.js';

const minute = 60_000;
const notFound = () => new ApiError(404, 'NOT_FOUND', 'Preview unavailable or expired.');
const notEligible = () => new ApiError(409, 'PRODUCT_INELIGIBLE', 'Photo try-on is unavailable for this piece.');
function retryable(job: TryOnJob) {
  return job.status === 'FAILED' && job.attempt < 2 &&
    !['INTERRUPTED','PRODUCT_INELIGIBLE','INVALID_REFERENCE','NOT_FOUND'].includes(job.errorCode ?? '');
}
function grant(job: TryOnJob, until: number) {
  return createHmac('sha256', job.grantSecret).update(job.id + ':' + until).digest('hex');
}
export function jobDto(job: TryOnJob) {
  const until = Math.min(Date.now() + 5 * minute, job.expiresAt.getTime());
  const resultUrl = job.status === 'COMPLETED'
    ? '/api/try-on/jobs/' + job.id + '/result?until=' + until + '&signature=' + grant(job, until)
    : null;
  return {id:job.id, status:job.status, expiresAt:job.expiresAt, errorCode:job.errorCode, canRetry:retryable(job), resultUrl};
}
export function verifyGrant(job: TryOnJob, until: number, signature: string) {
  if (job.status !== 'COMPLETED' || until < Date.now() || until > job.expiresAt.getTime() ||
      !/^[0-9a-f]{64}$/.test(signature) ||
      !timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(grant(job, until), 'hex'))) throw notFound();
}
async function lockReservations(tx: Prisma.TransactionClient) {
  // Serialize idempotency and the shared daily budget across API replicas.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(768510332)`;
}
async function reserve(tx: Prisma.TransactionClient, dailyLimit: number, jobId: string, attempt: number) {
  const day = new Date();
  day.setUTCHours(0,0,0,0);
  if (await tx.tryOnUsage.count({where:{createdAt:{gte:day}}}) >= dailyLimit) {
    throw new ApiError(429,'DAILY_LIMIT','The showroom has reached its daily preview limit.');
  }
  await tx.tryOnUsage.create({data:{jobId,attempt,createdAt:new Date()}});
}
export class TryOnRuntime {
  private readonly files: PrivatePhotos;
  private sweepingAt = 0;
  constructor(private db: PrismaClient, readonly provider: TryOnProvider, directory?: string) {
    this.files = new PrivatePhotos(directory);
  }
  async owned(id: string, ownerHash: string) {
    const job = await this.db.tryOnJob.findFirst({where:{id,ownerHash,deletedAt:null,expiresAt:{gt:new Date()}}});
    if (!job) throw notFound();
    return job;
  }
  private async eligible(db: Prisma.TransactionClient | PrismaClient, productId: string) {
    const config = await productConfig(db,productId);
    if (!config.public.photoEnabled || !config.public.kind || !config.referenceUrl) throw notEligible();
    return {...config,kind:config.public.kind,referenceUrl:config.referenceUrl};
  }
  private checkProvider() {
    if (!this.provider.configured) throw new ApiError(503,'PROVIDER_NOT_CONFIGURED','Photo try-on needs showroom provider configuration.');
  }
  async create(ownerHash: string, requestKey: string, productId: string, body: unknown, mime: string) {
    const config = await this.eligible(this.db,productId);
    this.checkProvider();
    const image = await validateImage(body,mime,config.public.maxUploadMb * 1048576);
    const requestHash = createHash('sha256').update(productId).update(image.buffer).digest('hex');
    const id = randomUUID();
    await this.files.write(id,'input',image.buffer);
    try {
      const job = await this.db.$transaction(async tx => {
        await lockReservations(tx);
        const existing = await tx.tryOnJob.findUnique({where:{ownerHash_requestKey:{ownerHash,requestKey}}});
        if (existing) {
          if (existing.requestHash !== requestHash || existing.deletedAt || existing.expiresAt <= new Date()) {
            throw new ApiError(409,'KEY_CONFLICT','Start a new preview to submit a different request.');
          }
          return existing;
        }
        const current = await this.eligible(tx,productId);
        if (image.bytes > current.public.maxUploadMb * 1048576) throw new ApiError(413,'PAYLOAD_TOO_LARGE','Photo is too large.');
        await reserve(tx,current.dailyLimit,id,1);
        const now = new Date();
        return tx.tryOnJob.create({data:{
          id,productId,sku:current.sku,kind:current.kind,referenceUrl:current.referenceUrl,
          ownerHash,requestKey,requestHash,grantSecret:randomBytes(32).toString('hex'),
          provider:this.provider.name,model:this.provider.model,promptVersion:PROMPT_VERSION,
          consentVersion,consentAt:now,createdAt:now,inputBytes:image.bytes,inputMime:'image/'+image.format,
          expiresAt:new Date(now.getTime()+current.public.retentionHours*3600000),
        }});
      });
      if (job.id !== id) await this.files.remove(id,'input');
      return job;
    } catch (error) {
      // A transaction acknowledgement can be lost after commit.
      const committed = await this.db.tryOnJob.findUnique({where:{id},select:{id:true}});
      if (!committed) await this.files.remove(id,'input');
      throw error;
    }
  }
  async retry(id: string, ownerHash: string) {
    this.checkProvider();
    return this.db.$transaction(async tx => {
      await lockReservations(tx);
      const job = await tx.tryOnJob.findFirst({where:{id,ownerHash,deletedAt:null,expiresAt:{gt:new Date()}}});
      if (!job) throw notFound();
      if (!retryable(job)) throw new ApiError(409,'RETRY_UNAVAILABLE','This preview cannot be retried.');
      const current = await this.eligible(tx,job.productId);
      if (current.referenceUrl !== job.referenceUrl || current.kind !== job.kind) throw notEligible();
      const attempt = job.attempt + 1;
      await reserve(tx,current.dailyLimit,id,attempt);
      return tx.tryOnJob.update({where:{id,attempt:job.attempt,status:'FAILED',deletedAt:null},data:{
        status:'QUEUED',attempt,model:this.provider.model,provider:this.provider.name,promptVersion:PROMPT_VERSION,
        errorCode:null,startedAt:null,completedAt:null,
      }});
    });
  }
  async result(job: TryOnJob) {
    await this.checkCurrent(job);
    return this.files.read(job.id,'output');
  }
  private async checkCurrent(job: TryOnJob) {
    const current = await this.eligible(this.db,job.productId);
    if (current.referenceUrl !== job.referenceUrl || current.kind !== job.kind) throw notEligible();
  }
  async discard(job: TryOnJob) {
    // Revoke access first. The sweep recovers tombstones after disk failures.
    await this.db.$transaction(async tx => {
      await tx.tryOnJob.updateMany({where:{id:job.id},data:{deletedAt:new Date()}});
      await tx.tryOnUsage.updateMany({where:{jobId:job.id,status:{in:['PROCESSING','QUEUED']}},data:{status:'FAILED'}});
    });
    await this.files.remove(job.id,'input');
    await this.files.remove(job.id,'output');
    await this.db.tryOnJob.deleteMany({where:{id:job.id,deletedAt:{not:null}}});
  }
  private async finish(job: TryOnJob, state: 'FAILED' | 'COMPLETED', details: Prisma.TryOnJobUpdateManyMutationInput) {
    return this.db.$transaction(async tx => {
      const changed = await tx.tryOnJob.updateMany({
        where:{id:job.id,status:'PROCESSING',attempt:job.attempt,deletedAt:null,expiresAt:{gt:new Date()}},
        data:{...details,status:state,completedAt:new Date()},
      });
      if (changed.count) await tx.tryOnUsage.update({where:{jobId_attempt:{jobId:job.id,attempt:job.attempt}},data:{status:state}});
      return changed.count;
    });
  }
  async cleanup() {
    const due = await this.db.tryOnJob.findMany({where:{OR:[{expiresAt:{lte:new Date()}},{deletedAt:{not:null}}]},take:100});
    for (const job of due) await this.discard(job);
    // A crash may leave the provider outcome unknown. Never redispatch automatically.
    const stalled = await this.db.tryOnJob.findMany({where:{
      status:'PROCESSING',startedAt:{lt:new Date(Date.now()-5*minute)},expiresAt:{gt:new Date()},deletedAt:null,
    },take:100});
    for (const job of stalled) {
      if (await this.finish(job,'FAILED',{errorCode:'INTERRUPTED'})) await this.files.remove(job.id,'input');
    }
    if (Date.now()-this.sweepingAt < minute) return;
    await this.files.sweep(async (id,part) => {
      const job = await this.db.tryOnJob.findFirst({where:{id,deletedAt:null,expiresAt:{gt:new Date()}}});
      if (!job) return false;
      if (part === 'output') return job.status === 'COMPLETED' || job.status === 'PROCESSING';
      return job.status === 'QUEUED' || job.status === 'PROCESSING' || retryable(job);
    });
    this.sweepingAt = Date.now();
  }
  async tick() {
    await this.cleanup();
    const job = await this.db.$transaction(async tx => {
      // Use the same bound application clock as admission and ownership expiry checks.
      const [claimed] = await tx.$queryRaw<{id:string}[]>`
        SELECT id FROM "TryOnJob" WHERE status='QUEUED' AND "deletedAt" IS NULL
        AND "expiresAt">${new Date()}
        ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!claimed) return null;
      const row = await tx.tryOnJob.update({where:{id:claimed.id},data:{status:'PROCESSING',startedAt:new Date()}});
      await tx.tryOnUsage.update({where:{jobId_attempt:{jobId:row.id,attempt:row.attempt}},data:{status:'PROCESSING'}});
      return row;
    });
    if (!job) return;
    let generated: Awaited<ReturnType<typeof validateImage>>;
    try {
      this.checkProvider();
      await this.checkCurrent(job);
      if (job.model !== this.provider.model || job.provider !== this.provider.name || job.promptVersion !== PROMPT_VERSION) {
        throw new ApiError(409,'PROVIDER_CHANGED','Provider configuration changed.');
      }
      const portrait = await this.files.read(job.id,'input');
      const output = await this.provider.generate({portrait,portraitMime:job.inputMime,referenceUrl:job.referenceUrl,kind:job.kind});
      generated = await validateImage(output.bytes,output.mime,20*1048576);
      await this.checkCurrent(job);
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.code : 'GENERATION_FAILED';
      const failed = await this.finish(job,'FAILED',{errorCode});
      if (failed && !retryable({...job,status:'FAILED',errorCode})) await this.files.remove(job.id,'input');
      return;
    }
    await this.files.write(job.id,'output',generated.buffer);
    const completed = await this.finish(job,'COMPLETED',{resultMime:'image/'+generated.format,resultBytes:generated.bytes});
    if (!completed) await this.files.remove(job.id,'output');
    else await this.files.remove(job.id,'input');
  }
}
export function createTryOnRuntime(db: PrismaClient, provider = createTryOnProvider(), directory?: string) {
  return new TryOnRuntime(db,provider,directory);
}
