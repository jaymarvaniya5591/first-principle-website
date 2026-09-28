import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const frames=new Map(), animations=[], events={}, media=[];
let frameId=0, y=600, height=844, time=0;
function node(rect={}) {
  const attrs={}, props={}, listeners={}, classes=new Set();
  return {attrs,props,listeners,hidden:false,inert:false,clientWidth:254,
    style:{setProperty:(k,v)=>props[k]=v,removeProperty:k=>delete props[k]},
    classList:{add:k=>classes.add(k),toggle:(k,on)=>on?classes.add(k):classes.delete(k),contains:k=>classes.has(k)},
    setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],
    addEventListener:(k,fn)=>listeners[k]=fn,
    getBoundingClientRect:()=>({top:0,bottom:0,height:0,...rect}),
    focus(){document.activeElement=this;},contains:()=>false,
    animate(keyframes,options){const a={keyframes,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;}
  };
}
const header=node({top:0,bottom:64,height:64}),heading=node({height:140});
const cards=Array.from({length:5},()=>{
  const c=node(),head=node({height:110}),toggle=node({height:44}),panel=node({height:400}),collapse=node(),body=node();
  const children={'.card__head':head,'.card__disclosure':toggle,'.card__details':panel,'.card__collapse':collapse,'.card__body':body};
  c.querySelector=s=>children[s]; c.contains=e=>Object.values(children).includes(e);
  c.getBoundingClientRect=()=>({top:1000-y,bottom:1000-y+400+(panel.hidden?0:400),height:400+(panel.hidden?0:400)});
  return c;
});
const stage=node(),carousel=node();carousel.dataset={active:'0'};
carousel.querySelectorAll=()=>cards;carousel.querySelector=()=>stage;
const section=node();section.clientWidth=366;
section.querySelector=s=>s==='.carousel'?carousel:heading;
const document={getElementById:()=>section,querySelector:()=>header,activeElement:null,
  documentElement:{style:{overflowAnchor:'auto'},scrollHeight:5000},fonts:{ready:{then(){}}}};
const window={scrollTo:({top})=>{y=top;},siteScroll:{cancel(){}},addEventListener:(type,fn)=>events[type]=fn};
const context=vm.createContext({document,window,Array,Math,
  get scrollY(){return y;},get innerHeight(){return height;},
  matchMedia:q=>{const m={matches:false,addEventListener(type,fn){this.change=fn;}};media.push(m);return m;},
  getComputedStyle:e=>e===section?{paddingTop:'40'}:e===heading?{marginBottom:'16'}:cards.includes(e)?{paddingBottom:'12'}:{paddingTop:'12',paddingBottom:'0',rowGap:'8'},
  requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:()=>1,clearTimeout(){},performance:{now:()=>time},ResizeObserver:class {observe(){}}
});
vm.runInContext(readFileSync(new URL('../js/mobile-product.js',import.meta.url),'utf8'),context);
const panel=i=>cards[i].querySelector('.card__details');
const toggle=i=>cards[i].querySelector('.card__disclosure');
function tick(t) {time=t;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(t));}
function finishHeight() {const a=[...animations].reverse().find(a=>a.options.duration===180&&!a.cancelled);a?.onfinish?.();}
assert.ok(section.classList.contains('product--mobile'));
assert.ok(cards.every((_,i)=>panel(i).hidden),'all products start collapsed');
assert.equal(toggle(0).attrs['aria-expanded'],'false');
assert.ok(parseFloat(section.props['--mobile-product-photo'])<=300);
// Collapsed browsing must not reposition, including repeated input.
y=710;carousel.onProductChange();tick(240);
assert.equal(y,710,'collapsed switch keeps the current page position');
carousel.onProductChange();tick(480);
assert.equal(y,710,'repeated collapsed switches stay still');
time=0;
const before=y;toggle(0).listeners.click();finishHeight();tick(240);
assert.equal(y,before,'expanding never moves the page');
assert.ok(cards.every((_,i)=>!panel(i).hidden),'expanded state is shared');
assert.equal(toggle(0).attrs['aria-expanded'],'true');
y=1350;carousel.dataset.active='1';carousel.onProductChange();tick(500);
assert.equal(y,924,'switch returns the photo to header plus 12px');
assert.equal(panel(1).hidden,false,'switch retains expansion');
y=1350;cards[1].querySelector('.card__collapse').listeners.click();finishHeight();tick(800);
assert.equal(y,924,'collapse from bottom restores compact card');
assert.equal(document.activeElement,toggle(1),'bottom collapse restores reachable focus');
assert.equal(panel(1).hidden,true);
// Rapid interactions cancel old height callbacks and finish in the latest state.
toggle(1).listeners.click();const old=animations.at(-1);toggle(1).listeners.click();
assert.ok(old.cancelled);old.onfinish?.();finishHeight();
assert.equal(panel(1).hidden,true);
// Manual input cancels a pending switch and deferred post-collapse assistance.
toggle(1).listeners.click();finishHeight();
y=1400;carousel.dataset.active='2';carousel.onProductChange();tick(880);
events.touchstart();const stopped=y;tick(1200);assert.equal(y,stopped);
y=1400;
cards[2].querySelector('.card__collapse').listeners.click();events.wheel();finishHeight();tick(1500);
assert.equal(y,1400,'manual input cancels deferred collapse assistance');
// Desktop always exposes features; returning to mobile restores disclosure state.
media[0].matches=true;media[0].change();assert.ok(cards.every((_,i)=>!panel(i).hidden));
assert.equal(section.classList.contains('product--mobile'),false);
media[0].matches=false;media[0].change();assert.ok(cards.every((_,i)=>panel(i).hidden));
// Reduced motion changes state and reading position without animation.
media[1].matches=true;media[1].change();const count=animations.length;
toggle(2).listeners.click();y=1400;carousel.dataset.active='3';carousel.onProductChange();
assert.equal(y,924);assert.equal(animations.length,count);
assert.equal(panel(3).hidden,false);
// Wings follow the visible intersection rather than the full expanded midpoint.
y=1200;events.scroll();tick(1800);
const wing=parseFloat(carousel.props['--wing-y']);
assert.ok(wing>=22&&wing<=778);
console.log('Mobile products: disclosure state, stable expansion, switch/collapse landing, rapid taps, interruption, focus, desktop restoration, reduced motion and wings passed.');
