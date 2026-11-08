// Isolated HTTP rendering checks. Test-only fixtures never enter the application database.
// Requires npm run build. Ports are loopback-only; process configuration is temporary.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let scenario='failure';
const home={version:null,publishedAt:null,sections:[],banners:[]};
const piece={id:'test-piece',slug:'test-only-piece',name:'TEST ONLY jewellery',sku:'TEST-ONLY',category:{id:'test-category',name:'TEST ONLY category',slug:'test-only'},purity:'Test',metal:'GOLD',enquiryOnly:true,publicPrice:'999999',availability:'AVAILABLE',images:[],newArrival:false,exclusive:false};
const listing=data=>({data,pagination:{page:1,limit:100,total:data.length,pages:Math.ceil(data.length/100)}});
const upstream=createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(scenario==='failure'){res.statusCode=503;res.end(JSON.stringify({error:{message:'Test-only upstream unavailable'}}));return;}
 const path=new URL(req.url,'http://localhost').pathname;
 if (path === '/api/collections' && scenario === 'collections-offline') {
   res.writeHead(503); res.end(JSON.stringify({error:{message:'Test-only failure'}})); return;
 }
 let payload;
 if(path==='/api/homepage')payload={data:scenario==='published'?{...home,version:1,sections:[{id:'test-hero',type:'HERO',heading:'TEST ONLY published headline',subtitle:null,description:null,ctaLabel:'Browse',ctaPath:'/products',desktopImage:null,mobileImage:null,products:[],collections:[]}]}:home};
 else if(path==='/api/contact-options')payload={data:{whatsappNumber:scenario==='products'?'+919000000001':null,timezone:null}};
 else if(path==='/api/products/test-only-piece')payload={data:{...piece,description:'TEST ONLY description',grossWeight:'1',netWeight:'1'}};
 else if(path==='/api/products')payload=listing(scenario==='products'?[piece]:[]);
 else payload=listing([]);
 res.end(JSON.stringify(payload));
});
await new Promise((resolve,reject)=>{upstream.once('error',reject);upstream.listen(4910,'127.0.0.1',resolve);});
const app=spawn(process.execPath,[fileURLToPath(new URL('../../../node_modules/next/dist/bin/next',import.meta.url)),'start','--hostname','127.0.0.1','--port','4911'],{cwd:process.env.SHOWROOM_TEST_WEB_DIR || fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,API_INTERNAL_URL:'http://127.0.0.1:4910'},stdio:['ignore','pipe','pipe'],windowsHide:true});
let logs='';app.stdout.on('data',b=>{logs+=b;});app.stderr.on('data',b=>{logs+=b;});
try{
 let ready=false;
 for(let i=0;i<80;i++){if(app.exitCode!==null)throw new Error('Isolated frontend failed to start: '+logs);try{await fetch('http://127.0.0.1:4911');ready=true;break;}catch{await new Promise(r=>setTimeout(r,250));}}
 assert.ok(ready,'isolated frontend starts');
 const site='http://127.0.0.1:4911';
 const publicOrigin='https://shreeramjewellers.store';
 const failedMap=await fetch(site+'/sitemap.xml');
 assert.equal(failedMap.status,503);
 assert.ok(failedMap.headers.has('retry-after'));
 assert.doesNotMatch(await failedMap.text(),/<loc>/);
 const robots=await (await fetch(site+'/robots.txt')).text();
 assert.ok(robots.includes('Sitemap: '+publicOrigin+'/sitemap.xml') && robots.includes('Disallow: /admin'));
 console.log('PASS: crawler rules and retryable catalogue outage on built SEO endpoints');
 const page=async()=>{const r=await fetch('http://127.0.0.1:4911');assert.equal(r.status,200);return (await r.text()).replace(/<!--[\s\S]*?-->/g,'');};
 let html=await page();assert.ok(html.includes('Some online selections are currently unavailable.'));assert.ok(html.includes('Featured jewellery couldn'));assert.ok(!html.includes('A little pause'));assert.ok(!html.includes('Your next favourite awaits'));console.log('PASS: failed responses remain errors, not empty success');
 scenario='empty';html=await page();assert.ok(html.includes('Your next favourite awaits'));assert.ok(html.includes('Room for something new'));assert.ok(!html.includes('Some online selections are currently unavailable.'));assert.ok(html.includes('Campaign photograph to follow.'));const order=['A world of little treasures','Pieces to fall for','Discover the collections','New to the jewellery box','Not just a piece.','A thought. A detail.','Make time for something special.'].map(t=>html.indexOf(t));assert.ok(order.every((v,i)=>v>=0&&(!i||v>order[i-1])));console.log('PASS: genuine empty responses, placeholder and default section order');
 scenario='products';html=await page();assert.ok(html.includes('TEST ONLY jewellery'));assert.ok(html.includes('Price on enquiry'));assert.ok(html.includes('View details'));assert.ok(html.includes('/products/test-only-piece#product-enquiry'));assert.ok(!html.includes('<span>₹9,99,999'));assert.ok(html.includes('https://wa.me/919000000001?text='));assert.ok(html.includes('Shop No. 7, Vitthal Rakhumai'));assert.ok(!html.includes('Business hours'));assert.ok(!html.includes('View directions'));assert.ok(!html.includes('We couldn’t retrieve:'));console.log('PASS: product cards retain price rule and detail/enquiry routes; verified contact fields only');
 for(const path of ['/products','/products?featured=true','/products?newArrival=true','/collections','/about','/custom-jewellery','/appointments','/contact','/wishlist','/request-status','/products/test-only-piece']){const response=await fetch('http://127.0.0.1:4911'+path);const body=(await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');assert.equal(response.status,200,path);assert.ok(!body.includes('This page is no longer here.'),path);if(path==='/products/test-only-piece'){assert.ok(body.includes('id="product-enquiry"'));assert.ok(body.includes('TEST ONLY jewellery'));}if(path==='/contact')assert.ok(body.includes('Wadala (West), Mumbai'));}console.log('PASS: 11 navigation/action destinations and product enquiry anchor');
 scenario='published';html=await page();assert.ok(html.includes('TEST ONLY published headline'));assert.ok(!html.includes('Pieces to fall for'));console.log('PASS: published CMS headline and sections remain authoritative');
 scenario='products';
 const mapResponse=await fetch(site+'/sitemap.xml');
 assert.equal(mapResponse.status,200);
 assert.ok((await mapResponse.text()).includes('<loc>'+publicOrigin+'/products/test-only-piece</loc>'));
 const productHead=await (await fetch(site+'/products/test-only-piece',{headers:{'user-agent':'Twitterbot'}})).text();
 assert.ok(productHead.includes('rel="canonical" href="'+publicOrigin+'/products/test-only-piece"'));
 console.log('PASS: published fixture detail URL in XML and canonical tag');
 scenario='collections-offline';
 const filtered='/products?search=gold&featured=true';
 const rendered=async path=>(await (await fetch(site+path)).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const failedFilter=await rendered(filtered);
 assert.match(failedFilter,/The collection filter is temporarily unavailable/);
 const retry=failedFilter.match(/<a[^>]*href="([^"]+)"[^>]*>Retry collection filter<\/a>/);
 assert.ok(retry);
 const retryUrl=new URL(retry[1].replaceAll('&amp;','&'),site);
 assert.equal(retryUrl.pathname,'/products');
 assert.equal(retryUrl.searchParams.get('search'),'gold');
 assert.equal(retryUrl.searchParams.get('featured'),'true');
 assert.match(failedFilter,/Nothing here quite matches/);
 scenario='empty';
 assert.doesNotMatch(await rendered(filtered),/Retry collection filter/);
 console.log('PASS: catalogue filter failure preserves other results and retry query; empty collections show no failure');
}finally{app.kill();await new Promise(resolve=>upstream.close(resolve));}


