import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {cloudLayout,cloudCeiling,boundaryPath} from '../js/hero-cloud-layout.js';
const stage={clientWidth:1536,clientHeight:704};
const box=(left,top,width,height,parent)=>({offsetLeft:left,offsetTop:top,offsetWidth:width,offsetHeight:height,offsetParent:parent,
  getBoundingClientRect(){throw new Error('Never use animated viewport geometry');}});
const content=box(192,104,512,462,stage),proof=box(0,398,512,64,content);
const marks=box(112,18,342,42,proof),label=box(0,30,88,14,proof),product=box(648,181,928,619,stage);
const measure=()=>cloudLayout(stage,product,content,proof,marks,label),first=measure();
for(const translate of [-1536,-750,-80,0]){
  content.style={transform:`translateX(${translate}px)`};product.style={transform:`translateX(${-translate}px)`};
  assert.deepEqual(measure(),first,'Entrance cannot change the mask');
}
assert.equal(first.logoRight,646,'Use actual marks, not the divider');
assert.equal(first.clearance,110,'Reserve 32px beneath logos');
assert.equal(first.left,671.2,'Anchor to the rock layout');
for(const [w,h] of [[1920,880],[1536,704],[1440,900],[1366,768]]){
  stage.clientWidth=w;stage.clientHeight=h;
  const layout=measure();
  for(let x=0;x<=layout.logoRight;x++)assert.ok(cloudCeiling(x,layout)<=layout.clearance);
  for(let x=1;x<w;x++)assert.ok(Math.abs(cloudCeiling(x,layout)-cloudCeiling(x-1,layout))<1,'No vertical cliff');
  assert.ok(!boundaryPath(layout).includes('NaN'));
}
stage.clientHeight=768;assert.equal(measure().clearance,174);
marks.offsetHeight+=12;assert.equal(measure().clearance,162);
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
assert.equal((html.match(/class="hero__cloud-scene /g)||[]).length,2);
assert.equal((html.match(/data:image\/webp;base64,/g)||[]).length,2,'Shared embedded textures only');
assert.ok(!/hero__cloud-canvas|has-textured-clouds|hero-clouds\.bundle|foundation\.webp/.test(html));
const source=await readFile(new URL('../js/hero-clouds.js',import.meta.url),'utf8');
assert.ok(!/createElement|appendChild|innerHTML|loadAsync|TextureLoader/.test(source),'Controller cannot add/swap artwork');
const css=await readFile(new URL('../css/styles.css',import.meta.url),'utf8');
assert.match(css,/prefers-reduced-motion: reduce[\s\S]*?hero__cloud-wind/);
// Rasterize the generated, JS-free pair together, testing real texture alpha.
const body=layer=>html.match(new RegExp(`<!-- HERO CLOUD ${layer}:START -->\\s*<svg[^>]*>([\\s\\S]*?)<\\/svg>`))[1];
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="220" viewBox="0 0 1600 220">${body('BACK')}${body('FRONT')}</svg>`;
const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let x=0;x<info.width;x++)assert.equal(data[((info.height-1)*info.width+x)*4+3],255,'Opaque full-width lower edge');
assert.ok(data.some((v,i)=>i%4===3&&v>0&&v<255),'Retain feathered transparency');
// The floor seal must diffuse vertically, with no wavy path or alpha step.
const defs=body('BACK').match(/<defs>[\s\S]*?<\/defs>/)[0];
const floor=body('FRONT').match(/<g id="hero-cloud-floor">[\s\S]*?<\/g>/)[0];
assert.ok(!floor.includes('<path'),'No visible wave-shaped floor contour');
const sealSvg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="220">${defs}${floor}</svg>`;
const seal=await sharp(Buffer.from(sealSvg)).ensureAlpha().raw().toBuffer();
let previous=0;
for(let y=0;y<220;y++){
  const alpha=seal[(y*1600+800)*4+3];
  assert.ok(alpha>=previous&&alpha-previous<=16,'Floor opacity must rise gradually');
  for(const x of [0,400,1200,1599])assert.equal(seal[(y*1600+x)*4+3],alpha,'No horizontal wave');
  previous=alpha;
}
assert.equal(previous,255,'Diffused seal must still conceal the bottom');
console.log('PASS: entrance stability, smooth boundary, logo clearance, resize, embedded scene membership, reduced-motion CSS, JS-free texture alpha and opaque bottom.');
