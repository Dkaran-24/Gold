import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { createTryOnProvider, type TryOnInput } from './provider.js';

const model = 'gemini-3.1-flash-image';
const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: model, CLOUDINARY_CLOUD_NAME: 'showroom-test' };
const url = 'https://res.cloudinary.com/showroom-test/image/upload/v2/showroom/products/qa/asset.png';
let image: Buffer;
let input: TryOnInput;
beforeAll(async () => {
  image = await sharp({create:{width:40,height:50,channels:3,background:'#123456'}}).png().toBuffer();
  input = { portrait: image, portraitMime: 'image/png', referenceUrl: url, kind: 'EARRINGS' };
});
const metadata = () => Response.json({ name: 'models/' + model, supportedGenerationMethods: ['generateContent'] });
const reference = () => new Response(new Uint8Array(image), { headers: {'content-type':'image/png'} });
const preview = () => Response.json({candidates:[{finishReason:'STOP',content:{parts:[
  {thought:true,inlineData:{mimeType:'image/png',data:'ignore'}},
  {inlineData:{mimeType:'image/png',data:image.toString('base64')}},
]}}]});
describe('Gemini photo adapter with isolated test transport', () => {
  it('requires a key, verified model ID and reference cloud', async () => {
    for (const missing of [{GEMINI_API_KEY:''},{GEMINI_MODEL:'text-only'},{CLOUDINARY_CLOUD_NAME:''}]) {
      const fetch = vi.fn();
      const provider = createTryOnProvider({...env,...missing}, fetch);
      expect(provider.configured).toBe(false);
      await expect(provider.generate(input)).rejects.toMatchObject({code:'PROVIDER_NOT_CONFIGURED'});
      expect(fetch).not.toHaveBeenCalled();
    }
  });
  it('rejects unrelated, redirected-source and untrusted reference paths before any HTTP request', async () => {
    const fetch = vi.fn();
    for (const referenceUrl of ['https://evil.test/img',url.replace('showroom-test','other'),url.replace('upload','fetch'),url+'?x=secret',url.replace('https://','https://alice@')]) {
      await expect(createTryOnProvider(env,fetch).generate({...input,referenceUrl})).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    }
    expect(fetch).not.toHaveBeenCalled();
  });
  it('checks project metadata before transmitting either image', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({name:'models/'+model,supportedGenerationMethods:['embedContent']}));
    await expect(createTryOnProvider(env,fetch).generate(input)).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE'});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1].body).toBeUndefined();
  });
  it('sends a sanitized portrait and reference by inline parts and returns the final decoded preview', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(reference()).mockResolvedValueOnce(preview());
    const result = await createTryOnProvider(env,fetch).generate(input);
    expect(result.mime).toBe('image/png');
    expect((await sharp(result.bytes).metadata()).width).toBe(40);
    const [destination, options] = fetch.mock.calls[2]!;
    expect(destination).toBe('https://generativelanguage.googleapis.com/v1/models/'+model+':generateContent');
    expect(options.headers['x-goog-api-key']).toBe(env.GEMINI_API_KEY);
    expect(fetch.mock.calls[1]?.[1]).toMatchObject({redirect:'error'});
    expect(fetch.mock.calls[1]?.[1].headers).toBeUndefined();
    const data = JSON.parse(options.body);
    expect(data.contents[0].parts[0].text).toContain('stone placement');
    for (const part of data.contents[0].parts.slice(1)) {
      expect((await sharp(Buffer.from(part.inline_data.data, 'base64')).metadata()).format).toBe('jpeg');
    }
    expect(data.generationConfig.responseModalities).toEqual(['IMAGE']);
  });
  it('rejects invalid catalogue bytes before sending a portrait to the model', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(new Response('forged',{headers:{'content-type':'image/png'}}));
    await expect(createTryOnProvider(env,fetch).generate(input)).rejects.toMatchObject({code:'INVALID_REFERENCE'});
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not return fabricated or partial results for blocked/text-only/corrupt generations', async () => {
    for (const finishReason of ['SAFETY','STOP']) {
      const response = Response.json({candidates:[{finishReason,content:{parts:[{text:'sensitive text'}]}}]});
      const fetch = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(reference()).mockResolvedValueOnce(response);
      await expect(createTryOnProvider(env,fetch).generate(input)).rejects.toMatchObject({code:'PROVIDER_OUTPUT'});
    }
    const response = Response.json({candidates:[{finishReason:'STOP',content:{parts:[{inlineData:{mimeType:'image/png',data:'YQ=='}}]}}]});
    const fetch = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(reference()).mockResolvedValueOnce(response);
    await expect(createTryOnProvider(env,fetch).generate(input)).rejects.toMatchObject({code:'PROVIDER_OUTPUT'});
  });
  it('redacts upstream failures and never retries a generation call automatically', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(metadata()).mockResolvedValueOnce(reference()).mockResolvedValueOnce(new Response('private details',{status:429}));
    await expect(createTryOnProvider(env,fetch).generate(input)).rejects.toMatchObject({code:'PROVIDER_UNAVAILABLE',message:'Photo try-on is unavailable. Please try again later.'});
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
