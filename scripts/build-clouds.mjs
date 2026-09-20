/** Deterministic inline SVG cloud scene. No runtime renderer or asset loads. */
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {build} from 'esbuild';
import {referenceCloudLayout as layout,boundaryPath} from '../js/hero-cloud-layout.js';
const sx=1600/layout.w,sy=220/layout.layerH;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'assets/img/hero-clouds');
const texture=async(name,size)=>'data:image/webp;base64,'+(await sharp(await readFile(path.join(assets,name))).resize(size,size,{fit:'inside'}).webp({quality:86,alphaQuality:100}).toBuffer()).toString('base64');
const soft=await texture('cloud-soft.webp',256),detail=await texture('cloud-detail.webp',384);
// A contour-free floor seal. Quintic easing has zero slope at both ends;
// squaring keeps the upper haze light without losing an opaque lower edge.
const sealStops=Array.from({length:25},(_,i)=>{
  const t=i/24,eased=t*t*t*(10+t*(-15+6*t));
  return `<stop offset="${t.toFixed(5)}" stop-color="white" stop-opacity="${(eased*eased).toFixed(5)}"/>`;
}).join('');
const rand=i=>{const x=Math.sin(i*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
const use=(x,y,w,h,opacity=1,type='soft')=>`<use href="#hero-cloud-${type}" x="${x}" y="${y}" width="${w}" height="${h}" opacity="${opacity}"/>`;
const fixedBank=Array.from({length:19},(_,i)=>{
  const seed=37+i*17;
  return use(Math.round(-180+i*102+rand(seed)*35),Math.round(125+rand(seed+1)*35),Math.round(235+rand(seed+2)*125),Math.round(160+rand(seed+3)*70),(.66+rand(seed+4)*.20).toFixed(2));
}).join('');
function wind(front){
  return Array.from({length:front?12:8},(_,i)=>{
    const seed=i*19+(front?81:207),phase=(i+rand(seed)*.8)/(front?12:8),duration=front?640:1500;
    return `<g class="hero__cloud-wind" style="--wind-duration:${duration}s;--wind-delay:${(-phase*duration).toFixed(2)}s"><g class="hero__cloud-shape" style="--shape-duration:${24+Math.round(rand(seed+2)*16)}s;--shape-delay:${(-rand(seed+3)*30).toFixed(2)}s">${use(-440,Math.round(104+rand(seed+4)*36),Math.round(240+rand(seed+5)*160),Math.round(170+rand(seed+6)*90),front?.20:.18,i%4===0?'detail':'soft')}</g></g>`;
  }).join('');
}
function pockets(front){
  return `<g class="hero__cloud-entrance"><g data-cloud-anchor="left" transform="translate(665 0)"><g class="hero__cloud-shape" style="--shape-duration:31s;--shape-delay:-7s">${use(-168,59,300,250,front?.68:.76)}${use(-80,91,310,220,front?.42:.62,'detail')}${use(-218,114,255,185,front?.50:.56)}</g></g><g data-cloud-anchor="right" transform="translate(1580 0)"><g class="hero__cloud-shape" style="--shape-duration:37s;--shape-delay:-19s">${use(-160,80,340,250,front?.38:.64)}</g></g></g>`;
}
const definitions=`<defs>
  <symbol id="hero-cloud-soft" viewBox="0 0 256 256" preserveAspectRatio="none"><image href="${soft}" width="256" height="256"/></symbol>
  <symbol id="hero-cloud-detail" viewBox="0 0 384 384" preserveAspectRatio="none"><image href="${detail}" width="384" height="384"/></symbol>
  <clipPath id="hero-cloud-limit"><path d="M0,159 L1600,159 L1600,224 L0,224 Z"/></clipPath>
  <filter id="hero-cloud-feather" x="-5%" y="-100%" width="110%" height="300%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="5 5"/></filter>
  <mask id="hero-cloud-envelope" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="224" style="mask-type:alpha"><g clip-path="url(#hero-cloud-limit)"><path id="hero-cloud-feather-path" d="M0,174 L1600,174 L1600,224 L0,224 Z" fill="white" filter="url(#hero-cloud-feather)"/></g></mask>
  <linearGradient id="hero-cloud-density" gradientUnits="userSpaceOnUse" x1="595" x2="945"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity=".52"/></linearGradient>
  <mask id="hero-cloud-rock-density" maskUnits="userSpaceOnUse" x="0" y="0" width="1600" height="224" style="mask-type:alpha"><rect width="1600" height="224" fill="url(#hero-cloud-density)"/></mask>
  <linearGradient id="hero-cloud-seal" gradientUnits="userSpaceOnUse" x1="0" y1="154" x2="0" y2="219">${sealStops}</linearGradient>
</defs>`;
const svg=(layer,body)=>`<svg class="hero__cloud-scene hero__cloud-scene--${layer}" data-cloud-layer="${layer}" viewBox="0 0 1600 220" preserveAspectRatio="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
// Bake the approved contour and product anchors into the unchanged artwork.
const bake=markup=>markup
  .replace('M0,159 L1600,159 L1600,224 L0,224 Z',boundaryPath(layout))
  .replace('M0,174 L1600,174 L1600,224 L0,224 Z',boundaryPath(layout,15))
  .replace('stdDeviation="5 5"','stdDeviation="'+(5*sx)+' '+(5*sy)+'"')
  .replace('x1="595" x2="945"','x1="'+((layout.left-70)*sx)+'" x2="'+((layout.left+280)*sx)+'"')
  .replaceAll('transform="translate(665 0)"','transform="translate('+(layout.left*sx)+' 0)"')
  .replaceAll('transform="translate(1580 0)"','transform="translate('+(layout.right*sx)+' 0)"');
const back=bake(svg('back',definitions+`<g mask="url(#hero-cloud-envelope)">${pockets(false)}${wind(false)}</g>`));
const front=bake(svg('front',`<g mask="url(#hero-cloud-envelope)"><g mask="url(#hero-cloud-rock-density)">${fixedBank}${pockets(true)}${wind(true)}</g></g><g id="hero-cloud-floor"><rect x="0" y="154" width="1600" height="70" fill="url(#hero-cloud-seal)"/></g>`));
const compiled=await build({entryPoints:[path.join(root,'js/hero-clouds.js')],bundle:true,write:false,format:'iife',minify:true,target:['chrome100','firefox100','safari15']});
const init=`<script>${compiled.outputFiles[0].text.trim()}</script>`;
const htmlPath=path.join(root,'index.html');
let html=await readFile(htmlPath,'utf8');
for(const [name,markup] of [['BACK',back],['FRONT',front],['INIT',init]]){
  const expression=new RegExp(`<!-- HERO CLOUD ${name}:START -->[\\s\\S]*?<!-- HERO CLOUD ${name}:END -->`);
  if(!expression.test(html))throw new Error('Missing generated cloud marker '+name);
  html=html.replace(expression,`<!-- HERO CLOUD ${name}:START -->\n${markup}\n<!-- HERO CLOUD ${name}:END -->`);
}
await writeFile(htmlPath,html);
await writeFile(path.join(assets,'SOURCES.txt'),'Embedded soft texture: pmndrs/assets, CC0 1.0\nhttps://github.com/pmndrs/assets\n\nEmbedded detail texture: WickedInsignia, CC0\nhttps://opengameart.org/content/clouds-with-transparency\n\nComposition: local inline SVG; generated by scripts/build-clouds.mjs. No WebGL runtime.\n');
console.log(`Built one inline SVG composition: ${Math.round((back.length+front.length+init.length)/1024)}KB, two layers, shared embedded textures.`);
