// Exercise the production Why-us controller against deterministic layout and
// input fixtures. Browser checks cover real CSS, fonts and compositing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const code = source.slice(source.indexOf('  /* ---------------- "Why us"'), source.indexOf('  /* ---------------- Nav:'));
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
section.querySelector=()=>heading;
heading.getBoundingClientRect=()=>({top:state.start-80-state.y});
scroll.getBoundingClientRect=()=>({top:state.start-state.y});
product.getBoundingClientRect=()=>({top:9000-state.y});
const names=['patents','warranty','service','returns','focus'];
const slides=names.map((name,i)=>{
  const el=node(); el.name=name; el.dataset.navTheme=i%2?'light':'dark';
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
track.querySelectorAll=()=>track.children.filter(s=>s!==intro);
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
  shortScreen:{get matches(){return state.height<=520;}}});
vm.runInContext(code,context);
const visibleSlides=()=>track.children.filter(s=>state.desktop || s!==intro);
const order=()=>visibleSlides().map(s=>s.name);
const x=()=>Number.parseFloat(scroll.style.getPropertyValue('--why-x'));
const paintAt=distance=>{state.y=state.start+distance;context.updateWhyScroll();};
const key=key=>track.events.keydown({key,preventDefault(){}});

assert.deepEqual(order(),['intro','warranty','service','returns','focus','patents']);
assert.deepEqual(visibleSlides().map(s=>s.dataset.navTheme),['dark','light','dark','light','dark','light']);
assert.equal(context.whyLayout.horizontal,true);
assert.ok(Math.abs(context.whyToneDarkness(.056))<1e-12,'surface starts at white');
assert.equal(context.whyToneDarkness(.462),1,'wash meets the exact black slide');
assert.equal(context.whyToneDarkness(0),0,'top edge is transparent');
for(let i=1;i<65;i++) assert.ok(context.whyToneSamples[i]>context.whyToneSamples[i-1],'lightness never reverses');
assert.ok(context.whyToneSamples[1]<.02,'gentle white endpoint');
assert.ok(context.whyToneSamples[63]>.99,'gentle black endpoint');
paintAt(-900); assert.equal(Math.abs(context.whyLightShift),0,'Technology remains clear at entrance start');
assert.match(section.style.getPropertyValue('--why-tone-stops'),/^rgb\(255.0000,255.0000,255.0000\) 5.600000vh/,'surface starts at real white');
assert.match(section.style.getPropertyValue('--why-tone-stops'),/rgb\(17.0000,17.0000,17.0000\) 46.200000vh$/,'surface ends at exact slide black');
// Keep the same quarter-tone colours while shortening their physical spacing.
paintAt(-450);
assert.ok(context.whyToneDarkness(.124875)>.1 && context.whyToneDarkness(.327875)<.92,'quarter tones retain a broad mid-grey range');
assert.ok(Math.abs(context.whyTonePositions[64] / 66 - .7)<1e-10,'visible gradient window is 30% shorter');
assert.ok((context.whyTonePositions[16]-context.whyTonePositions[0]) < (context.whyTonePositions[64]-context.whyTonePositions[48]),'compression removes more pale space than shadow detail');
let lastEdge=Infinity;
for(let i=0;i<=40;i++) {
  const progress=i/40;
  paintAt(-(1-progress)*900);
  const edge=(1-progress)*900+context.whyLightShift;
  assert.ok(edge<lastEdge,'receding light always travels upward');
  lastEdge=edge;
}
paintAt(-450); const lightAtMiddle=context.whyLightShift;
paintAt(-200); paintAt(-450);
assert.equal(context.whyLightShift,lightAtMiddle,'light retraces its path when reversing');
assert.equal(Number.parseFloat(scroll.style.getPropertyValue('--why-height')),8460);
paintAt(90); assert.equal(Math.abs(x()),0,'opening reading allowance');
paintAt(180+1440); assert.equal(x(),-1280,'1.6 viewport heights advances one full slide');
paintAt(180+1440*2); assert.equal(x(),-2560);
paintAt(180+1440); assert.equal(x(),-1280,'reverse input reverses directly');
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
assert.deepEqual(order(),names,'mobile restores the original DOM order');
assert.deepEqual(visibleSlides().map(s=>s.dataset.navTheme),['dark','light','dark','light','dark']);
state.desktop=true; context.measureWhy();
assert.equal(context.whyLayout.horizontal,true,'desktop can be restored');
assert.deepEqual(order(),['intro','warranty','service','returns','focus','patents']);
skip.events.click(); assert.equal(destination,9000); assert.equal(scroll.dataset.skipping,'false');
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
assert.equal(state.y,9000,'reduced-motion fallback navigation is immediate');
assert.equal(frames.size,0);
console.log('Why us: pacing, holds, reversal, keyboard, resize, motion/fit fallbacks, mobile restoration, Skip and interrupted native navigation passed.');
