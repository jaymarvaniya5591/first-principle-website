import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped controller against a clock and pointer-capable DOM,
// including complete-card ownership across the desktop breakpoint.
let now=0, id=0, layoutReads=0;
const frames=new Map(), queries=[], intersections=[], events={}, changes=[];
function node() {
  const classes=new Set(), props={}, captures=new Set();
  return {children:[],attrs:{},listeners:{},style:{setProperty:(k,v)=>props[k]=v,removeProperty(k){delete props[k];delete this[k];}},props,
    clientWidth:334,hidden:false,closest(){return null;},
    get offsetHeight(){layoutReads++;return this.height||334;},
    classList:{add(...names){names.forEach(n=>classes.add(n));},remove(...names){names.forEach(n=>classes.delete(n));},contains:n=>classes.has(n),toggle(n,on){if(on)classes.add(n);else classes.delete(n);}},
    appendChild(el){if(el.parentNode)el.parentNode.children=el.parentNode.children.filter(c=>c!==el);this.children.push(el);el.parentNode=this;},
    insertBefore(el,before){if(el.parentNode)el.parentNode.children=el.parentNode.children.filter(c=>c!==el);const i=this.children.indexOf(before);this.children.splice(i<0?this.children.length:i,0,el);el.parentNode=this;},
    get firstChild(){return this.children[0];},
    setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
    addEventListener(k,v){this.listeners[k]=v;},
    setPointerCapture(i){captures.add(i);},hasPointerCapture:i=>captures.has(i),releasePointerCapture(i){captures.delete(i);},
    getBoundingClientRect(){layoutReads++;return {width:this.clientWidth,height:this.height||334,top:100,bottom:434};}
  };
}
const cards=Array.from({length:5},(_,i)=>{
  const c=node(),head=node(),media=node(),img=node();head.height=110+i*5;
  img.alt=['Novi','Vero','Aera','Sora','Liva'][i];img.complete=true;img.naturalWidth=1024;
  media.querySelector=()=>img;media.appendChild(img);c.appendChild(media);c.appendChild(head);
  c.querySelector=s=>s==='.card__media'?media:head;
  return c;
});
const images=cards.map(c=>c.querySelector('.card__media'));
const section=node(),carousel=node(),stage=node();carousel.dataset={active:'0'};carousel.querySelectorAll=()=>cards;carousel.querySelector=()=>stage;
cards.forEach(c=>stage.appendChild(c));
function layout(){cards.forEach((c,i)=>{c.inert=i!==Number(carousel.dataset.active);c.setAttribute('aria-hidden',String(c.inert));});}
layout();
const document={hidden:false,querySelector:()=>carousel,getElementById:()=>section,createElement:()=>node(),fonts:{ready:{then(){}}},addEventListener:(k,fn)=>events[k]=fn};
carousel.changeProduct=(direction,source)=>{
  const previousIndex=Number(carousel.dataset.active),index=(previousIndex+direction+5)%5;
  carousel.dataset.active=String(index);layout();const change={previousIndex,index,direction,source};changes.push(change);carousel.cardDeck.change(change);
};
const context=vm.createContext({document,window:{addEventListener:(k,fn)=>events[k]=fn},Array,Math,
  performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:i=>frames.delete(i),
  matchMedia:query=>{const q={query,matches:false,addEventListener:(k,fn)=>q.change=fn};queries.push(q);return q;},
  ResizeObserver:class{observe(){}},IntersectionObserver:class{constructor(fn){intersections.push(fn);}observe(){}}
});
vm.runInContext(fs.readFileSync(new URL('../js/mobile-card-deck.js',import.meta.url),'utf8'),context);
const deck=carousel.cardDeck.element;
function tick(time=now+400){now=time;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));}
function pointer(type,x,y,time,extra={}){now=time;deck.listeners[type]({clientX:x,clientY:y,timeStamp:time,pointerId:1,button:0,target:deck,isPrimary:true,cancelable:true,preventDefault(){},...extra});}
function gesture(dx,dy=0,duration=240){const t=now;pointer('pointerdown',200,200,t);pointer('pointermove',200+dx,200+dy,t+duration);tick(t+duration+1);pointer('pointerup',200+dx,200+dy,t+duration+2);tick();}
tick();
carousel.cardDeck.setSceneProgress(.35,0,true);
const partialEntrance=cards.map(el=>el.style.transform);
carousel.cardDeck.setSceneProgress(.8,0,true);
carousel.cardDeck.setSceneProgress(.35,0,true);
assert.deepEqual(cards.map(el=>el.style.transform),partialEntrance,'collection assembly retraces without timed replay');
carousel.cardDeck.takeover();
assert.deepEqual(cards.map(el=>el.style.transform),partialEntrance,'interaction takes over without jumping');
carousel.cardDeck.setSceneProgress(.9,0,true);
assert.deepEqual(cards.map(el=>el.style.transform),partialEntrance,'scroll progress cannot move an interacting card');
carousel.cardDeck.setSceneProgress(0,0,false);
carousel.cardDeck.setSceneProgress(1,0,true);
assert.ok(cards.every(el=>el.parentNode===deck));
assert.ok(images.every((el,i)=>el.parentNode===cards[i]),'photos stay attached to their product details');
assert.equal(section.props['--mobile-product-head'],'130px','reserve the tallest real product heading');
assert.equal(cards.filter(el=>el.attrs['aria-hidden']==='false').length,1);
assert.match(cards[1].style.transform,/26\.020px/,'94% scale plus offset leaves a 16px whole-card preview');
const readsBeforeDrag=layoutReads;
pointer('pointerdown',200,200,now,{target:{closest(){return {};}}});
assert.equal(deck.hasPointerCapture(1),false,'buttons keep native clicks and focus');
gesture(-100);
assert.equal(layoutReads,readsBeforeDrag,'drag and settling perform no layout reads');
assert.equal(carousel.dataset.active,'1');assert.equal(changes.at(-1).source,'drag');
gesture(100);assert.equal(carousel.dataset.active,'0');
gesture(100);assert.equal(carousel.dataset.active,'4','previous from first wraps');
gesture(-100);assert.equal(carousel.dataset.active,'0');
const count=changes.length;
gesture(-110,200);gesture(3);gesture(-20,0,400);
assert.equal(changes.length,count,'vertical, incidental and short slow gestures do not select');
gesture(-20,0,20);assert.equal(carousel.dataset.active,'1','a short deliberate flick selects');
let t=now;pointer('pointerdown',200,200,t);pointer('pointermove',60,200,t+40);tick(t+41);pointer('pointercancel',60,200,t+42);tick();
assert.equal(carousel.dataset.active,'1');assert.match(cards[1].style.transform,/0\.000px/,'pointer cancellation restores the selected card');
t=now;pointer('pointerdown',200,200,t);pointer('pointermove',80,200,t+50);tick(t+51);pointer('lostpointercapture',80,200,t+52);tick();
assert.equal(carousel.dataset.active,'1','lost capture never commits');
t=now;pointer('pointerdown',200,200,t);pointer('pointerdown',230,210,t+20,{pointerId:2,isPrimary:false});pointer('pointerup',50,200,t+40);tick();
assert.equal(carousel.dataset.active,'1','multi-touch cancels selection for native pinch zoom');
carousel.changeProduct(1,'button');tick(now+80);
const before=cards.map(el=>el.style.transform);
carousel.changeProduct(-1,'keyboard');
assert.deepEqual(cards.map(el=>el.style.transform),before,'retargeting starts from the currently rendered poses');tick();
assert.equal(carousel.dataset.active,'1');assert.match(cards[1].style.transform,/0\.000px/);
for(let i=0;i<12;i++)carousel.changeProduct(1,'button');tick();
assert.equal(carousel.dataset.active,'3','rapid input accumulates selection without queuing motion');
assert.equal(frames.size,0);
images[3].querySelector('img').listeners.error();assert.ok(images[3].classList.contains('has-image-error'));
images[3].querySelector('img').listeners.load();assert.ok(!images[3].classList.contains('has-image-error'));
t=now;pointer('pointerdown',200,200,t);pointer('pointermove',100,200,t+40);tick(t+41);
deck.clientWidth=280;events.resize();tick();assert.match(cards[3].style.transform,/0\.000px/);assert.equal(deck.hasPointerCapture(1),false);
queries[0].matches=true;queries[0].change();
assert.ok(images.every((el,i)=>el.parentNode===cards[i]));assert.equal(deck.tabIndex,-1);
assert.ok(cards.every(el=>el.style.transform===undefined),'desktop receives the original untransformed articles');
assert.ok(images.every(el=>el.style.transform===undefined),'photos never receive independent swipe transforms');
queries[0].matches=false;queries[0].change();tick();assert.ok(cards.every(el=>el.parentNode===deck));
queries[1].matches=true;queries[1].change();carousel.changeProduct(1,'button');assert.equal(frames.size,0,'reduced motion settles immediately');
queries[1].matches=false;queries[1].change();carousel.changeProduct(1,'button');
document.hidden=true;events.visibilitychange();assert.equal(frames.size,0,'hidden tabs stop pending motion and measurements');
document.hidden=false;events.visibilitychange();tick();intersections[0]([{isIntersecting:false}]);carousel.changeProduct(1,'button');assert.equal(frames.size,0,'offscreen decks do not animate');
assert.equal(cards.filter(el=>el.attrs['aria-hidden']==='false').length,1);
console.log('Complete card deck: drag, flick, axis discrimination, cancellation, pinch, wraparound, rapid reversal, stable details, article and media ownership, failures, resize, reduced motion and visibility passed.');
