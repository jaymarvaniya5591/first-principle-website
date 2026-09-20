/** Inlined layout controller. All artwork already exists in HTML.
 * No texture loading, readiness class, scene swap or per-frame JavaScript.
 */
import {cloudLayout,boundaryPath} from './hero-cloud-layout.js';
const stage=document.querySelector('.hero__inner'),product=document.querySelector('.hero__toilet');
const content=document.querySelector('.hero__content'),proof=document.querySelector('.hero__proof');
const marks=document.querySelector('.hero__proof__marks'),label=document.querySelector('.hero__proof__label');
const desktop=matchMedia('(min-width:900px)');
const local=/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const testMode=local?new URLSearchParams(location.search).get('clouds'):null;
let lastLayout='',resizeFrame=0;
function measure(){
  resizeFrame=0;if(!desktop.matches)return;
  const layout=cloudLayout(stage,product,content,proof,marks,label),signature=JSON.stringify(layout);
  if(signature===lastLayout)return;lastLayout=signature;
  const sx=1600/layout.w,sy=220/layout.layerH;
  document.querySelector('#hero-cloud-limit path').setAttribute('d',boundaryPath(layout));
  document.querySelector('#hero-cloud-feather-path').setAttribute('d',boundaryPath(layout,15));
  document.querySelector('#hero-cloud-feather feGaussianBlur').setAttribute('stdDeviation',`${5*sx} ${5*sy}`);
  const density=document.querySelector('#hero-cloud-density');
  density.setAttribute('x1',(layout.left-70)*sx);density.setAttribute('x2',(layout.left+280)*sx);
  stage.style.setProperty('--cloud-enter-x',(innerWidth*sx)+'px');
  for(const pocket of stage.querySelectorAll('[data-cloud-anchor]')){
    const x=pocket.dataset.cloudAnchor==='left'?layout.left:layout.right;
    pocket.setAttribute('transform',`translate(${x*sx} 0)`);
  }
  if(local)stage.dataset.cloudLayout=signature;
}
function schedule(){if(!resizeFrame)resizeFrame=requestAnimationFrame(measure);}
if(stage&&product&&content&&proof&&marks&&label){
  // Build-inlined after the copy: no asynchronous renderer handoff.
  if(testMode!=='fallback'){
    measure();const observer=new ResizeObserver(schedule);
    for(const node of [stage,product,content,proof,marks])observer.observe(node);
    document.fonts.ready.then(schedule);desktop.addEventListener('change',schedule);
  }
  if(testMode==='still'||testMode==='fallback')stage.classList.add('clouds-still');
  else stage.classList.add('clouds-live');
  let onScreen=true;
  const pause=()=>stage.classList.toggle('clouds-paused',document.hidden||!onScreen);
  new IntersectionObserver(entries=>{onScreen=entries[0].isIntersecting;pause();}).observe(stage);
  document.addEventListener('visibilitychange',pause);
}
