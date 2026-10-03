import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/smooth-scroll.js',import.meta.url),'utf8');
function fixture(active=true) {
  const events={};let controller;
  const window={innerHeight:600,addEventListener(name,fn){events[name]=fn;}};
  class Lenis {
    constructor(options){controller=this;this.options=options;this.actualScroll=0;this.limit=12000;this.calls=[];}
    on(){} resize(){} destroy(){}
    stop(){this.animation=null;}
    start(){}
    scrollTo(target,options){
      this.calls.push({target,options});
      if(options.immediate){this.actualScroll=target;this.animation=null;}
      else this.animation={from:this.actualScroll,target,options};
    }
    advance(progress){
      const a=this.animation;if(!a)return;
      this.actualScroll=a.from+(a.target-a.from)*(progress===1?1:a.options.easing(progress));
      if(progress===1){this.animation=null;a.options.onComplete?.();}
    }
  }
  window.Lenis=Lenis;
  vm.runInNewContext(source,{window,Lenis,Math,document:{documentElement:{clientWidth:1280}},matchMedia:()=>({matches:active,addEventListener(){}})});
  return {window,controller,events};
}
const f=fixture(),s=f.window.siteScroll,c=f.controller;
s.to(600);const near=c.calls.at(-1).options;
s.to(9000);const far=c.calls.at(-1).options;
assert.ok(near.duration<far.duration && far.duration<=1.5);
assert.equal(far.easing(0),0);assert.equal(far.easing(1),1);
const ease=far.easing,h=.0001;
const acceleration=t=>(ease(t+h)-2*ease(t)+ease(t-h))/(h*h);
assert.ok(Math.abs(acceleration(.32-h)-acceleration(.32+h))<.02,'no acceleration corner');
assert.ok(Math.abs(acceleration(h))<.02 && Math.abs(acceleration(1-h))<.02,'soft departure and arrival');
for(let i=1;i<=100;i++)assert.ok(ease(i/100)>ease((i-1)/100));
let done=0;
for(const [start,target] of [[0,10000],[10000,0]]) {
 c.actualScroll=start;const beforeCalls=c.calls.length;
 s.to(target,()=>done++,{cut:[2000,8000]});
 const positions=[];for(let i=0;i<=100;i++){c.advance(i/100);positions.push(c.actualScroll);}
 assert.equal(c.actualScroll,target);
 assert.ok(positions.every(y=>y<=2000||y>=8000),'skip only the held runway');
 assert.ok(positions.every((y,i)=>!i||(target>start?y>=positions[i-1]:y<=positions[i-1])));
 assert.equal(c.calls.length-beforeCalls,1,'one Lenis journey, no per-frame immediate resets');
}
assert.equal(done,2);
s.to(10000,()=>done++,{cut:[2000,8000]});c.advance(.25);
const interrupted=c.actualScroll;
f.events.keydown({key:'ArrowUp',target:{closest:()=>null}});
c.advance(1);assert.equal(c.actualScroll,interrupted);assert.equal(done,3);
s.to(10000,()=>done++,{cut:[2000,8000]});c.advance(.3);
s.to(0,()=>done++,{cut:[2000,8000]});c.advance(1);
assert.equal(c.actualScroll,0);assert.equal(done,5,'retargeting releases callbacks once');
s.to(0,()=>done++);assert.equal(done,6,'same-position click completes');
s.to(10000,()=>done++);c.advance(.2);const resizedAt=c.actualScroll;f.events.resize();c.advance(1);
assert.equal(c.actualScroll,resizedAt);assert.equal(done,7);
s.to(10000,()=>done++);c.advance(.2);c.options.virtualScroll({event:{type:'wheel'},deltaY:20});
assert.equal(done,8,'wheel input releases the held scene');
assert.equal(fixture(false).window.siteScroll.to(100),false,'native/reduced motion retains its fallback');
console.log('Section motion: continuous acceleration, single-controller forward/reverse routes, exact landings, retargeting, keyboard/wheel interruption, resize and native fallback passed.');
