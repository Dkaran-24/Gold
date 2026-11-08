const formats = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validatePhotoFile(file: Pick<File, 'type' | 'size'>) {
  if (!formats.has(file.type)) throw new Error('Choose a JPG, PNG or WebP photograph.');
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a photograph smaller than 10 MB.');
}

export function photoSize(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 256 ||
      Math.max(width, height) > 10000 || width * height > 25000000) {
    throw new Error('Choose a photo at least 256 × 256 pixels and no larger than 25 megapixels or 10,000 pixels per side.');
  }
  const ratio = Math.min(1, 1600 / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/** Bound raster dimensions before asking the browser to allocate decoded pixels. */
export function inspectPhoto(bytes: Uint8Array, mime: string) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(start:number,end:number)=>String.fromCharCode(...bytes.slice(start,end));
  let width=0,height=0;
  if(mime==='image/png' && bytes.length>=24 && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n) && text(12,16)==='IHDR') {
    width=view.getUint32(16);height=view.getUint32(20);
  } else if(mime==='image/jpeg' && bytes[0]===255 && bytes[1]===216) {
    let offset=2;
    while(offset+4<=bytes.length) {
      if(bytes[offset++]!==255)break;
      while(bytes[offset]===255)offset++;
      const marker=bytes[offset++];
      if(marker===0xda || marker===0xd9 || offset+2>bytes.length)break;
      const length=view.getUint16(offset);
      if(length<2 || offset+length>bytes.length)break;
      if(marker!==undefined && [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length>=8) {
        height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;
      }
      offset+=length;
    }
  } else if(mime==='image/webp' && text(0,4)==='RIFF' && text(8,12)==='WEBP') {
    for(let offset=12;offset+8<=bytes.length;) {
      const kind=text(offset,offset+4), length=view.getUint32(offset+4,true), start=offset+8;
      if(start+length>bytes.length)break;
      if(kind==='VP8X' && length>=10) {
        width=1+bytes[start+4]!+(bytes[start+5]!<<8)+(bytes[start+6]!<<16);
        height=1+bytes[start+7]!+(bytes[start+8]!<<8)+(bytes[start+9]!<<16);break;
      }
      if(kind==='VP8 ' && length>=10 && bytes[start+3]===157 && bytes[start+4]===1 && bytes[start+5]===42) {
        width=view.getUint16(start+6,true)&0x3fff;height=view.getUint16(start+8,true)&0x3fff;break;
      }
      if(kind==='VP8L' && length>=5 && bytes[start]===47) {
        const packed=view.getUint32(start+1,true);width=1+(packed&0x3fff);height=1+((packed>>>14)&0x3fff);break;
      }
      offset=start+length+(length%2);
    }
  }
  if(!width || !height)throw new Error('This file is not a valid JPG, PNG or WebP photograph.');
  return photoSize(width,height);
}

export async function decodePhoto(file: File): Promise<HTMLCanvasElement> {
  validatePhotoFile(file);
  inspectPhoto(new Uint8Array(await file.arrayBuffer()),file.type);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(()=>{throw new Error('This photograph could not be opened. Try a different file.');});
    const size = photoSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    Object.assign(canvas, size);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preview is unavailable in this browser.');
    context.drawImage(image, 0, 0, size.width, size.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}
