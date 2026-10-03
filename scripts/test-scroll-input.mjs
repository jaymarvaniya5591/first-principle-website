// Use the shipped Lenis engine, including its equal-target early return. A
// scrollTo mock missed that cancelling at the current position could be a no-op.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const vendor=readFileSync(new URL('../js/vendor/lenis-1.3.26.min.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../js/smooth-scroll.js',import.meta.url),'utf8');
function fixture(width=1280) {
  class Target {
    events=new Map();
    addEventListener(name,fn){if(!this.events.has(name))this.events.set(name,[]);this.events.get(name).push(fn);}
    removeEventListener(name,fn){this.events.set(name,(this.events.get(name)||[]).filter(f=>f!==fn));}
    dispatchEvent(event){event.target??=this;for(const fn of [...(this.events.get(event.type)||[])])fn(event);}
  }
  class Element extends Target {matches(){return false;}hasAttribute(){return false;}closest(){return null;}}
  const root=new Element();Object.assign(root,{clientWidth:width,clientHeight:720,scrollWidth:width,scrollHeight:14000});
  root.classList=new Set();root.classList.remove=root.classList.delete;
  class Window extends Target {
    innerHeight=720;innerWidth=width;scrollY=0;scrollX=0;
    scrollTo({top}){this.scrollY=top;}
    matchMedia(query){return {matches:query.includes('min-width')?width>=1100:false,addEventListener(){}};}
  }
  const window=new Window(),frames=new Map();let serial=0,time=0;
  const context=vm.createContext({window,document:{documentElement:root},Window,HTMLElement:Element,
    navigator:{userAgent:'test'},Math,console,setTimeout,clearTimeout,
    matchMedia:query=>window.matchMedia(query),ResizeObserver:class {observe(){}disconnect(){}},
    CustomEvent:class {constructor(type){this.type=type;}},
    requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)});
  vm.runInContext(vendor,context);window.Lenis=context.Lenis;vm.runInContext(source,context);
  const tick=milliseconds=>{const end=time+milliseconds;while(time<end){time+=1000/120;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));}};
  const event=(type,extra={})=>({type,target:root,cancelable:true,defaultPrevented:false,
    preventDefault(){this.defaultPrevented=true;},composedPath:()=>[root,window],...extra});
  const wheel=(deltaY,extra={})=>{const e=event('wheel',{deltaY,deltaX:0,deltaMode:0,...extra});window.dispatchEvent(e);return e;};
  const place=y=>{window.siteScroll.cancel();window.scrollY=y;window.siteScroll.cancel();};
  return {window,root,tick,event,wheel,place,scroll:window.siteScroll};
}

const f=fixture();
for(const stop of [
  ()=>f.scroll.cancel(),
  ()=>f.window.dispatchEvent(f.event('touchstart',{targetTouches:[{clientX:20,clientY:20}]})),
  ()=>f.window.dispatchEvent(f.event('keydown',{key:'ArrowUp'})),
  ()=>f.window.dispatchEvent(f.event('pointerdown',{clientX:1280,button:0})),
  ()=>f.window.dispatchEvent(f.event('resize')),
  ()=>f.wheel(0,{deltaX:30})
]) {
  f.place(900);let released=0;
  f.scroll.to(11000,()=>released++,{cut:[1800,9500]});f.tick(100);
  const before=f.window.scrollY;stop();f.tick(2000);
  assert.equal(f.window.scrollY,before,'interrupting a real Lenis anchor must stop its animation, including the skipped runway');
  assert.equal(released,1,'interruption releases the navigation hold once');
}

// Equal wheel impulses have the same distance everywhere. No section may add
// travel, and reversing input cancels the pending forward target immediately.
const distances=[];
for(const at of [900,2500,4500,7000,10000]) {
  f.place(at);f.wheel(120);f.tick(2200);distances.push(f.window.scrollY-at);
}
assert.ok(distances.every(d=>Math.abs(d-distances[0])<.001));
assert.ok(distances[0]>0&&distances[0]<=120,'ordinary wheel input is never amplified');
f.place(3000);for(let i=0;i<6;i++){f.wheel(50);f.tick(8);}
const beforeReverse=f.window.scrollY;f.wheel(-20);f.tick(2200);
assert.ok(f.window.scrollY<beforeReverse,'reverse from the visible position, without forward carry');
f.place(3000);f.scroll.to(11000);f.tick(100);const wheelStart=f.window.scrollY;f.wheel(40);f.tick(2200);
assert.ok(f.window.scrollY-wheelStart>0&&f.window.scrollY-wheelStart<=40,'wheel interrupts an anchor and adds only its own distance');

// Returning to the exact current position must also terminate the old trip.
f.place(2000);f.scroll.to(9000);f.tick(120);const current=f.window.scrollY;
f.scroll.to(current);f.tick(2000);assert.equal(f.window.scrollY,current);

for(const width of [390,768]) {
  const mobile=fixture(width);assert.equal(mobile.scroll.active,false);
  assert.equal(mobile.wheel(120).defaultPrevented,false,'phone/tablet wheel input stays native');
  const touch=mobile.event('touchmove',{targetTouches:[{clientX:20,clientY:50}]});
  mobile.window.dispatchEvent(touch);assert.equal(touch.defaultPrevented,false,'native touch is not intercepted');
  assert.equal(mobile.scroll.to(1000),false);
}
console.log('Real scroll engine: genuine cancellation, touch/keyboard/scrollbar interruption, consistent wheel distance, immediate reversals and native mobile input passed.');
