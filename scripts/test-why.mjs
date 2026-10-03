// Exercise the production Why-us controller against deterministic layout and
// input fixtures. Browser checks cover real CSS, fonts and compositing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const productDestinationCode = source.slice(source.indexOf('  var productDestination ='), source.indexOf('  var measureProduct ='));
const code = productDestinationCode + source.slice(source.indexOf('  /* ---------------- "Why us"'), source.indexOf('  /* ---------------- Nav:'));
const state = {desktop:true, reduced:false, height:900, width:1280, y:0, start:1200, contentHeight:350};
const frames = new Map();
const windowEvents = new Map();
let serial = 0, destination = null;
function node() {
  const classes = new Set(), properties = new Map(), attributes = new Map();
  return {
    dataset:{}, events:{},
    classList:{contains:k=>classes.has(k),remove:k=>classes.delete(k),toggle(k,on){if(on) classes.add(k); else classes.delete(k);}},
    style:{setProperty:(k,v)=>properties.set(k,String(v)),removeProperty:k=>properties.delete(k),getPropertyValue:k=>properties.get(k)||''},
    addEventListener(k,fn){this.events[k]=fn;},
    setAttribute:(k,v)=>attributes.set(k,String(v)), removeAttribute:k=>attributes.delete(k),
    getAttribute:k=>attributes.get(k),
    getBoundingClientRect:()=>({top:0,left:0,width:100,height:60}),
    focus(){}, contains:()=>false
  };
}
const section=node(), track=node(), scroll=node(), sticky=node(), heading=node(), skip=node(), product=node();
Object.defineProperty(section,'clientWidth',{get:()=>state.width});
section.querySelector=selector=>selector==='.why__viewport-probe'?{getBoundingClientRect:()=>({height:state.stableHeight||state.height})}:heading;
heading.getBoundingClientRect=()=>({top:state.start-80-state.y});
scroll.getBoundingClientRect=()=>({top:state.start-state.y,height:parseFloat(scroll.style.getPropertyValue('--why-height'))||state.height*6});
product.getBoundingClientRect=()=>({top:9000-state.y});
const names=['warranty','service','returns','focus','patents'];
const slides=names.map((name,i)=>{
  const el=node(); el.name=name; el.dataset.whyScene=name; el.dataset.navTheme=i%2?'dark':'light';
  const inner={get scrollHeight(){return state.contentHeight;}, get scrollWidth(){return state.width-80;}};
  el.querySelector=()=>inner;
  el.getBoundingClientRect=()=>({
    left:section.classList.contains('why--horizontal')?track.children.indexOf(el)*state.width+Number.parseFloat(scroll.style.getPropertyValue('--why-x')||'0'):0,
    top:state.start-state.y+(section.classList.contains('why--horizontal')?0:track.children.indexOf(el)*(state.height+160))
  });
  return el;
});
const intro=node(); intro.name='intro'; intro.dataset.navTheme='dark'; intro.querySelector=slides[0].querySelector; intro.getBoundingClientRect=()=>({left:Number.parseFloat(scroll.style.getPropertyValue('--why-x')||'0'),top:state.start-state.y});
track.children=[intro,...slides];
track.querySelector=()=>intro;
track.querySelectorAll=()=>track.children;
track.appendChild=el=>{track.children=track.children.filter(s=>s!==el).concat(el);};
const document={
  activeElement:null, elementsFromPoint:()=>[],
  querySelector:s=>({'.why__scroll-container':scroll,'.why__sticky':sticky,'.why__track':track,'.topbar':node()})[s]||null,
  getElementById:id=>({'why-us':section,'skip-why':skip,product})[id]||null
};
const window={
  get innerHeight(){return state.height;}, get scrollY(){return state.y;},
  matchMedia:q=>({get matches(){return q.includes('reduced-motion')?state.reduced:state.desktop;},addEventListener(){}}),
  addEventListener(type,fn){if(!windowEvents.has(type))windowEvents.set(type,[]);windowEvents.get(type).push(fn);},
  requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},
  cancelAnimationFrame:id=>frames.delete(id),
  scrollTo(arg,y){state.y=typeof arg==='object'?arg.top:y;},
  siteScroll:{cancel(){},to(target,done){destination=target;state.y=target;if(done)done();return true;}}
};
const context=vm.createContext({window,document,Array,Math,ResizeObserver:undefined,
  collectionMedia:{get matches(){return state.desktop;}},
  productHeading:heading,getComputedStyle:el=>el===product?{paddingTop:'40px'}:{marginBottom:'20px'},
  productHeader:node(),productSection:product,isDesktop:()=>state.desktop,
  shortScreen:{get matches(){return state.height<=520;}}});
vm.runInContext(code,context);
const visibleSlides=()=>track.children;
const order=()=>visibleSlides().map(s=>s.name);
const x=()=>Number.parseFloat(scroll.style.getPropertyValue('--why-x'));
const paintAt=distance=>{state.y=state.start+distance;context.updateWhyScroll();};
const key=key=>track.events.keydown({key,preventDefault(){}});

assert.deepEqual(order(),['intro','warranty','service','returns','focus','patents']);
assert.deepEqual(visibleSlides().map(s=>s.dataset.navTheme),['dark','light','dark','light','dark','light']);
assert.equal(context.whyLayout.horizontal,true);
assert.equal(context.whyLayout.prelude,0,'desktop intro starts immediately after Technology');
// Keep the new solid boundary while preserving the original scroll pacing.
const css=readFileSync(new URL('../css/styles.css',import.meta.url),'utf8');
assert.ok(!css.includes('--why-tone-stops') && !css.includes('--why-mist-clip'));
assert.equal(Number.parseFloat(scroll.style.getPropertyValue('--why-height')),8460);
paintAt(90); assert.equal(Math.abs(x()),0,'opening reading allowance');
paintAt(180+1440); assert.equal(x(),-1280,'1.6 viewport heights advances one full slide');
paintAt(180+1440*2); assert.equal(x(),-2560);
paintAt(180+1440); assert.equal(x(),-1280,'reverse input reverses directly');
for(let segment=0;segment<5;segment++) {
  for(const fraction of [0,.05,.15,.25,.5,.8,1]) {
    const expected=-1280*(segment+fraction);
    paintAt(180+1440*(segment+fraction));
    assert.ok(Math.abs(x()-expected)<.00001,'desktop panel travel stays proportional to scroll everywhere, without pauses or speed boosts');
  }
}
paintAt(180+1440*5+90); assert.equal(x(),-6400,'closing reading allowance');
paintAt(99999); assert.equal(x(),-6400,'clamp at the end');
paintAt(-600); assert.equal(Math.abs(x()),0,'clamp before entry');
assert.equal(section.style.getPropertyValue('--why-reveal'),'0.00000');
paintAt(-270);
const titleAtMiddle=Number(section.style.getPropertyValue('--why-reveal'));
const brandAtMiddle=Number(section.style.getPropertyValue('--why-brand-reveal'));
const noteAtMiddle=Number(section.style.getPropertyValue('--why-note-reveal'));
assert.ok(titleAtMiddle>brandAtMiddle && brandAtMiddle>noteAtMiddle && noteAtMiddle>0,'phrases and reassurance reveal in order');
paintAt(0);
for(const property of ['--why-reveal','--why-brand-reveal','--why-note-reveal']) {
  assert.equal(section.style.getPropertyValue(property),'1.00000','all text settles before horizontal travel');
}
paintAt(-270);
assert.deepEqual(['--why-reveal','--why-brand-reveal','--why-note-reveal'].map(k=>Number(section.style.getPropertyValue(k))),[titleAtMiddle,brandAtMiddle,noteAtMiddle],'the complete stagger retraces on reversal');
paintAt(180+1440*.4); key('ArrowRight'); assert.equal(destination,1200+180+1440);
key('ArrowLeft'); assert.equal(destination,1200+180);
paintAt(50); context.measureWhy(); assert.equal(state.y,1250,'remeasure must not skip the opening hold');

paintAt(180+1440*2);
state.width=1440; state.height=768; context.measureWhy();
assert.ok(Math.abs(x()+2880)<.001,'resizing retains the current slide');
paintAt(-384);
state.height=900; context.measureWhy();
assert.ok(Math.abs((state.start-state.y)/context.whyLayout.entrance-.5)<.001,'resizing retains entrance progress');
state.reduced=true; context.measureWhy();
assert.equal(context.whyLayout.horizontal,false,'reduced motion uses flow');
assert.equal(scroll.style.getPropertyValue('--why-x'),'');
assert.equal(section.style.getPropertyValue('--why-reveal'),'');
assert.equal(section.style.getPropertyValue('--why-note-reveal'),'');
assert.equal(section.style.getPropertyValue('--why-brand-reveal'),'');
assert.equal(track.tabIndex,-1);
assert.deepEqual(order(),['intro','warranty','service','returns','focus','patents']);
state.reduced=false; state.height=500; context.measureWhy();
assert.equal(context.whyLayout.horizontal,false,'short screens use flow');
state.height=768; state.contentHeight=1000; context.measureWhy();
assert.equal(context.whyLayout.horizontal,false,'enlarged content remains reachable');
state.contentHeight=350; state.desktop=false; context.measureWhy();
state.width=390; state.height=844; state.stableHeight=844; context.measureWhy();
assert.equal(context.whyLayout.stacked,true);
assert.equal(context.whyLayout.prelude,0,'mobile begins directly at the final Technology rule');
for(const property of ['--why-tone-stops','--why-grain-stops','--why-light-shift','--why-mist-clip']) {
  assert.equal(section.style.getPropertyValue(property),'','mobile clears the desktop decorative plane');
}
assert.equal(context.whyLayout.hold,0);
assert.equal(Number.parseFloat(scroll.style.getPropertyValue('--why-height')),6*844);
assert.deepEqual(order(),['intro',...names],'shared reading order on mobile');
assert.deepEqual(visibleSlides().map(s=>s.dataset.navTheme),['dark','light','dark','light','dark','light']);
const cardY=i=>parseFloat(track.children[i].style.getPropertyValue('--why-card-y'));
for(let card=1;card<6;card++) for(const fraction of [0,.1,.15,.25,.5,.75,1]) {
  paintAt((card-1+fraction)*844);
  const cover=Math.max(0,(fraction-.15)/.85);
  assert.ok(Math.abs(cardY(card)-(1-cover)*100)<.00001,'short reading hold then a direct cover within the original segment');
  assert.equal(cardY(card-1),0,'previous card remains stationary');
}
paintAt(.5*844); const halfCover=cardY(1);
for(const fraction of [0,.15,.5,.7,.8,.9,.98,1,.8,.5]) {
  paintAt(fraction*844);
  const entry=Math.max(0,Math.min(1,(fraction-.15)/.85));
  const originalCurve=(start,end)=>1-Math.pow(1-Math.max(0,Math.min(1,(entry-start)/(end-start))),3);
  assert.equal(track.children[1].style.getPropertyValue('--why-detail'),originalCurve(.64,.98).toFixed(5),'mobile warranty first statistic and divider retain their exact original progress');
  assert.equal(track.children[1].style.getPropertyValue('--why-last'),originalCurve(.73,1).toFixed(5),'mobile warranty second statistic retains its exact original progress');
}
paintAt(.8*844);paintAt(.5*844);assert.equal(cardY(1),halfCover,'reverse retraces the same cover');
paintAt(.98*844);
assert.equal(track.children[1].style.getPropertyValue('--why-content'),'1.00000','heading is settled before the next hold');
assert.equal(track.children[1].style.getPropertyValue('--why-detail'),'1.00000','supporting content is settled before the next hold');
paintAt(.5*844);
key('ArrowDown'); assert.equal(destination,state.start+844);
key('ArrowUp'); assert.equal(destination,state.start);
paintAt(2.4*844); const beforeToolbar=cardY(3);
state.height=920; context.updateWhyScroll();
assert.equal(context.whyLayout.height,844,'toolbar changes do not resize the stable stage');
assert.equal(cardY(3),beforeToolbar);
state.width=768; state.height=1024; state.stableHeight=1024; context.measureWhy();
assert.ok(Math.abs(cardY(3)-beforeToolbar)<.001,'orientation preserves fractional card progress');
state.reduced=true; context.measureWhy();
assert.equal(context.whyLayout.animated,false);
track.children.forEach(s=>assert.equal(s.style.getPropertyValue('--why-card-y'),''));
assert.equal(order().length,6,'all six slides remain readable in fallback');
state.reduced=false; state.stableHeight=0; state.width=1440;
state.desktop=true; context.measureWhy();
assert.equal(context.whyLayout.horizontal,true,'desktop can be restored');
assert.deepEqual(order(),['intro','warranty','service','returns','focus','patents']);
skip.events.click(); assert.equal(destination,8960); assert.equal(scroll.dataset.skipping,'false');
window.siteScroll.to=()=>false;
paintAt(180);
skip.events.click(); assert.equal(scroll.dataset.skipping,'true');
function advance(time) {const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));}
advance(0); advance(300);
assert.ok(state.y>1380 && state.y<9000,'native fallback advances');
const interruptedAt=state.y;
windowEvents.get('wheel').forEach(fn=>fn());
advance(600);
assert.equal(state.y,interruptedAt,'wheel input cancels fallback momentum');
assert.equal(scroll.dataset.skipping,'false','interruption releases the track');
state.reduced=true;
skip.events.click();
assert.equal(state.y,8960,'reduced-motion fallback navigation respects the fixed header');
assert.equal(frames.size,0);
console.log('Why us: pacing, holds, reversal, keyboard, resize, motion/fit fallbacks, mobile stacking, stable viewport, shared reading order, Skip and interrupted native navigation passed.');

state.desktop=false;
assert.equal(context.productDestination(),8968,'mobile product landing preserves heading clearance with 40px padding');

state.reduced=false;state.width=390;state.height=844;state.stableHeight=844;context.measureWhy();
paintAt(-844);
assert.equal(section.style.getPropertyValue('--why-reveal'),'0.00000');
paintAt(-.4*844);
const mobileText=section.style.getPropertyValue('--why-brand-reveal');
paintAt(-.1*844);
for(const property of ['--why-reveal','--why-brand-reveal','--why-note-reveal']) assert.equal(section.style.getPropertyValue(property),'1.00000','mobile entrance settles before reaching the header');
paintAt(-.4*844);assert.equal(section.style.getPropertyValue('--why-brand-reveal'),mobileText,'mobile text reverses with the panel');
assert.equal(section.style.getPropertyValue('--why-mist-clip'),'','mobile never writes a mist surface');
document.hidden=true;const hiddenPosition=cardY(1);paintAt(844);assert.equal(cardY(1),hiddenPosition,'hidden pages do not animate');
document.hidden=false;context.updateWhyScroll();assert.equal(cardY(1),0,'visible page resumes at its actual position');

// The native mobile link fallback must yield as soon as a finger touches down.
paintAt(0);let mobileNavigationFinished=0;
context.navigateWhy(8968,()=>mobileNavigationFinished++);
advance(0);advance(100);const beforeTouch=state.y;
windowEvents.get('touchstart').forEach(fn=>fn());advance(1000);
assert.equal(state.y,beforeTouch,'mobile touch cancels the pending link trip without adding distance');
assert.equal(mobileNavigationFinished,1);

// Mobile-only hotel proof adds a scene, never an input multiplier or an empty
// desktop segment. Existing warranty and all other per-scene pacing stay exact.
const trust=node();trust.name='trust';trust.dataset.whyScene='trust';trust.dataset.mobileOnly='true';trust.dataset.navTheme='dark';
trust.querySelector=slides[0].querySelector;
trust.getBoundingClientRect=()=>({left:0,top:state.start-state.y+6*(state.height+160)});
track.children.push(trust);context.whyAllSlides.push(trust);
state.y=0;state.desktop=true;state.width=1440;state.height=900;state.stableHeight=0;
context.measureWhy();
assert.equal(context.whySlides.length,6,'desktop keeps exactly its original six scenes');
assert.equal(context.whyLayout.journey,900*1.6*5);
state.desktop=false;state.width=390;state.height=844;state.stableHeight=844;
context.measureWhy();
assert.equal(context.whySlides.length,7,'mobile includes the hotel scene');
assert.equal(context.whyLayout.journey,844*6,'one unchanged viewport segment per mobile transition');
assert.deepEqual(order(),['intro','warranty','service','returns','trust','patents','focus'],'mobile DOM order matches the visible scene order');
assert.deepEqual(Array.from(context.whySlides).map(slide=>slide.style.getPropertyValue('--why-layer')),['1','2','3','4','5','6','7'],'cover layers follow the reordered scenes');
paintAt(3.7*844);const trustMiddle=trust.style.getPropertyValue('--why-card-y');
paintAt(4*844);assert.equal(trust.style.getPropertyValue('--why-card-y'),'0.00000%');
paintAt(3.7*844);assert.equal(trust.style.getPropertyValue('--why-card-y'),trustMiddle);
paintAt(4*844);state.desktop=true;state.width=1440;state.height=900;state.stableHeight=0;context.measureWhy();
assert.equal(context.whySlides.length,6);
assert.ok(Math.abs(x()+5*1440)<.001,'rotating out of the hotel card lands on the last real desktop scene');
console.log('Mobile hotel scene: desktop exclusion, native pacing, reversal and breakpoint restoration passed.');

assert.deepEqual(Array.from(context.whySlides).map(s=>s.name),['intro','warranty','service','returns','focus','patents'],'desktop order restores exactly');
state.desktop=false;state.width=390;state.height=844;state.stableHeight=844;context.measureWhy();
paintAt(6*844);assert.equal(context.whySlides[6].name,'focus');
state.desktop=true;state.width=1440;state.height=900;state.stableHeight=0;context.measureWhy();
assert.ok(Math.abs(x()+4*1440)<.001,'the focus scene remains active when rotating from the new last position');

// Browsers clamp scrollY if temporarily unpinning the section makes the whole
// document shorter. Remeasuring after cancellation must not move the viewport.
const removeClass=section.classList.remove;
section.classList.remove=name=>{
  removeClass(name);
  if(name==='why--horizontal' && !parseFloat(scroll.style.getPropertyValue('min-height'))) state.y=Math.min(state.y,5504);
};
paintAt(context.whyLayout.runway+250);
const collectionPosition=state.y;
context.measureWhy();
assert.equal(state.y,collectionPosition,'a same-layout measurement preserves scroll position after the pinned section');
assert.equal(scroll.style.getPropertyValue('min-height'),'','the measurement reservation is released after layout settles');
section.classList.remove=removeClass;

// Navigation improvements remain independent of manual scroll settings.
state.desktop=true;state.width=1280;state.height=900;state.stableHeight=0;state.contentHeight=250;state.y=0;context.measureWhy();
const introPaints=[];
window.siteMotion={paintWhy:(slide,index,entry,covered)=>introPaints.push({slide,index,entry,covered})};
paintAt(-900);scroll.dataset.skipping='true';paintAt(-450);
assert.ok(Number(section.style.getPropertyValue('--why-reveal'))>0);
assert.equal(introPaints.at(-1).entry,.5,'intro animates before the link trip finishes');
paintAt(0);assert.equal(introPaints.at(-1).entry,1);
assert.equal(introPaints.at(-1).covered,0,'returning from below prepares readable intro text');
scroll.dataset.skipping='false';paintAt(180+720);
assert.ok(Math.abs(x()+640)<.001,'interruption restores the original proportional track position');
window.siteMotion=null;

// Below 1100px a fine-pointer laptop uses the native route rather than Lenis.
for(const [from,to] of [[0,9000],[9000,0]]) {
  state.y=from;const positions=[];let finished=0;
  context.navigateWhy(to,()=>finished++,{cut:[2000,7000]});
  for(let time=0;time<=1700;time+=25) {advance(time);positions.push(state.y);}
  assert.equal(state.y,to);
  assert.equal(finished,1);
  assert.ok(positions.every(y=>y<=2000||y>=7000),'native laptop skips the same held interval');
  assert.ok(positions.every((y,i)=>!i||(to>from?y>=positions[i-1]:y<=positions[i-1])),'native route never reverses');
}
