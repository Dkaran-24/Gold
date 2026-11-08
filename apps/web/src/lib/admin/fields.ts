import { z } from 'zod';
export interface Field {name:string;label:string;type?:'text'|'textarea'|'number'|'checkbox'|'select'|'datetime-local'|'url'|'image'|'category-image';required?:boolean;nullable?:boolean;max?:number;min?:number;step?:number;options?:{value:string;label:string}[];initial?:string|number|boolean;hint?:string}
export const options=(values:string[])=>values.map(value=>({value,label:value.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase())}));
export const text=(name:string,label:string,max=200,required=false):Field=>({name,label,max,required});
export const area=(name:string,label:string,max=10000):Field=>({...text(name,label,max),type:'textarea'});
export const check=(name:string,label:string,initial=false):Field=>({name,label,type:'checkbox',initial});
export const select=(name:string,label:string,values:string[],initial?:string):Field=>({name,label,type:'select',options:options(values),required:true,initial:initial||values[0]});
export const imageField=(name:string,label:string):Field=>({name,label,type:'image',nullable:true});
export const dateField=(name:string,label:string):Field=>({name,label,type:'datetime-local',nullable:true});
const weight=(name:string,label:string,required=false):Field=>({name,label,type:'number',min:required&&name==='grossWeight'?0.001:0,max:9999999.999,step:0.001,required,nullable:!required});
const money=(name:string,label:string):Field=>({name,label,type:'number',min:0,max:999999999999.99,step:0.01,nullable:true});
export const slug:Field={...text('slug','Website slug',100,true),hint:'Lowercase letters, numbers and hyphens. Example: gold-pendant'};
export const seo:Field[]=[{...text('seoTitle','SEO title',200),nullable:true},{...area('seoDescription','SEO description',500),nullable:true}];
export const productFields:Field[]=[text('name','Product name',200,true),text('sku','Unique SKU',100,true),slug,{name:'categoryId',label:'Category',type:'select',required:true},select('metal','Metal',['GOLD','SILVER','PLATINUM','MIXED']),text('purity','Purity',50,true),area('description','Description'),weight('grossWeight','Gross weight (g)',true),weight('netWeight','Net weight (g)',true),weight('stoneWeight','Stone weight (g)'),...['stone','diamond','gemstone'].map(s=>({...area(`${s}Details`,`${s.charAt(0).toUpperCase()+s.slice(1)} details`,2000),nullable:true})),{...text('hallmark','Hallmark',200),nullable:true},{...text('huid','HUID',100),nullable:true},check('enquiryOnly','Hide price — enquiry only',true),money('publicPrice','Public price (₹)'),money('publicMakingCharge','Public making charge (₹)'),select('availability','Inventory status',['AVAILABLE','RESERVED','SOLD','ARCHIVED']),select('publication','Publication',['DRAFT','PUBLISHED']),check('featured','Featured product'),check('exclusive','Exclusive product'),dateField('arrivalDate','Arrival date'),dateField('newUntil','New arrival until'),...seo];
export const categoryFields:Field[]=[text('name','Category name',100,true),slug,area('description','Description',5000),{name:'imageUrl',label:'Category image',type:'category-image',nullable:true,max:2048},check('visible','Visible on website',true),{name:'sortOrder',label:'Display order',type:'number',min:0,max:100000,step:1,required:true,initial:0,hint:'Lower numbers appear first. Edit this number to reorder.'}];
export const collectionFields:Field[]=[text('name','Collection name',200,true),slug,area('description','Description'),imageField('coverImageId','Cover image'),imageField('bannerImageId','Banner image'),check('bridal','Bridal collection'),check('visible','Visible on website',true),select('publication','Publication',['DRAFT','PUBLISHED']),...seo];
export const sectionTypes=['HERO','FEATURED_COLLECTIONS','NEW_ARRIVALS','FEATURED_PRODUCTS','BRIDAL','PROMOTIONAL','CUSTOM_JEWELLERY','APPOINTMENT','EDITORIAL'];
const contentFields:Field[]=[text('internalName','Internal name',200,true),text('heading','Heading',300,true),area('subtitle','Subtitle',1000)];
const ctaFields:Field[]=[text('ctaLabel','Button text',100),{...text('ctaPath','Button destination',500),hint:'A website path, for example /products or /appointments.'}];
const scheduleFields=[dateField('startsAt','Schedule starts'),dateField('endsAt','Schedule ends')];
export const sectionFields:Field[]=[select('type','Section type',sectionTypes),...contentFields,area('description','Description'),...ctaFields,{name:'productId',label:'Featured product (featured products only)',type:'select',nullable:true},{name:'collectionId',label:'Collection (featured collections or bridal only)',type:'select',nullable:true},imageField('desktopImageId','Desktop image'),imageField('mobileImageId','Mobile image'),check('enabled','Enabled',true),...scheduleFields];
export const bannerFields:Field[]=[...contentFields,imageField('desktopImageId','Desktop image'),imageField('mobileImageId','Mobile image'),text('imageAlt','Image description',500,true),...ctaFields.map(f=>({...f,required:true})),check('active','Active',true),select('publication','Publication',['DRAFT','PUBLISHED']),...scheduleFields];
export function formPayload(fields:Field[], form:FormData):Record<string,unknown> {
  const result:Record<string,unknown>={};
  for(const f of fields) {
    const raw=String(form.get(f.name)??'').trim(); let value:unknown=raw;
    if(f.name==='enquiryOnly') {
      const rawVal = form.get('enquiryOnly');
      if (rawVal === 'true' || rawVal === 'on' || rawVal === '1') value = true;
      else if (rawVal === 'false' || rawVal === '0') value = false;
      else value = form.has('enquiryOnly');
    }
    else if(f.type==='checkbox') value=form.has(f.name);
    else if(!raw&&f.nullable)value=null;
    else if(f.type==='number')value=raw?Number(raw):NaN;
    else if(f.type==='datetime-local')value=raw?new Date(raw).toISOString():null;
    let rule:z.ZodType=z.string().max(f.max??10000);
    if(f.type==='checkbox')rule=z.boolean();
    else if(f.type==='number'){let n=z.number().finite().min(f.min??0).max(f.max??Number.MAX_SAFE_INTEGER);if(f.step)n=n.multipleOf(f.step);rule=n;}
    else if(f.type==='datetime-local')rule=z.iso.datetime();
    else if(f.type==='select'&&f.options?.length)rule=z.enum(f.options.map(v=>v.value));
    else if(f.required)rule=z.string().min(1,`${f.label} is required.`).max(f.max??10000);
    if(f.nullable)rule=rule.nullable();
    const checked=rule.safeParse(value);if(!checked.success)throw new Error(`${f.label}: ${checked.error.issues[0]?.message}`);
    result[f.name]=value;
  }
  if(form.has('imagePublicId')) { const pid=String(form.get('imagePublicId')??'').trim(); result.imagePublicId = pid || null; }
  for (const k of ['desktopImageUrl', 'desktopImagePublicId', 'mobileImageUrl', 'mobileImagePublicId']) {
    if (form.has(k)) { const v = String(form.get(k) ?? '').trim(); result[k] = v || null; }
  }
  if (form.has('imageUrl') && !('imageUrl' in result)) {
    const v = String(form.get('imageUrl') ?? '').trim();
    if (v) result.imageUrl = v;
  }
  if('slug' in result&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(result.slug)))throw new Error('Website slug must use lowercase letters, numbers and single hyphens.');
  if(result.imageUrl&&!String(result.imageUrl).startsWith('https://')&&!String(result.imageUrl).startsWith('{'))throw new Error('Category image URL must use HTTPS.');
  if('grossWeight'in result){
    if(Number(result.netWeight)>Number(result.grossWeight))throw new Error('Net weight cannot exceed gross weight.');
    if(result.enquiryOnly){
      result.publicPrice = null;
      result.publicMakingCharge = null;
    } else {
      if(result.publicPrice===null || Number(result.publicPrice)<=0)throw new Error('Enter a public price greater than zero or enable enquiry-only pricing.');
    }
    if(result.availability==='ARCHIVED'&&result.publication==='PUBLISHED')throw new Error('Unpublish before archiving.');
  }
  if(result.newUntil&&(!result.arrivalDate||String(result.newUntil)<=String(result.arrivalDate)))throw new Error('New arrival expiry must follow the arrival date.');
  if(result.startsAt&&result.endsAt&&String(result.endsAt)<=String(result.startsAt))throw new Error('Schedule end must follow its start.');
  if(result.ctaPath&&!/^\/(?!\/)[a-zA-Z0-9/_?=&%#.-]*$/.test(String(result.ctaPath)))throw new Error('Button destination must be a relative website path.');
  if(result.ctaPath&&/%(?:2f|5c|0[ad])/i.test(String(result.ctaPath)))throw new Error('Button destination contains an unsafe encoded character.');
  if('ctaPath'in result&&Boolean(result.ctaPath)!==Boolean(result.ctaLabel))throw new Error('Provide both button text and destination.');
  if(result.type){
    const hasDesktop = Boolean(result.desktopImageId || result.desktopImageUrl);
    if(['HERO','PROMOTIONAL'].includes(String(result.type))&&!hasDesktop)throw new Error('This section needs a desktop image.');
    if(result.type==='EDITORIAL'&&!result.description)throw new Error('Editorial sections need a description.');
    if(result.type==='BRIDAL'&&!result.collectionId)throw new Error('Choose a published bridal collection.');
    if(['CUSTOM_JEWELLERY','APPOINTMENT'].includes(String(result.type))&&!result.ctaPath)throw new Error('This section needs a button and destination.');
    if(result.productId&&result.type!=='FEATURED_PRODUCTS')throw new Error('Only featured products sections accept a product.');
    if(result.collectionId&&!['BRIDAL','FEATURED_COLLECTIONS'].includes(String(result.type)))throw new Error('Only bridal or featured collections sections accept a collection.');
  }
  if('imageAlt'in result&&!result.desktopImageId&&!result.imageUrl&&!result.desktopImageUrl)throw new Error('Banners require a desktop image.');
  return result;
}

