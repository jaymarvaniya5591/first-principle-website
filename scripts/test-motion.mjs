import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../js/site-motion.js', import.meta.url), 'utf8');
const math = source.slice(source.indexOf('  function clamp'), source.indexOf('  var desktop'));
const context = vm.createContext({Math});
vm.runInContext(math, context);
const {scenePose, wordPose, departure} = context;

// A complete trip down/up must reproduce every pose, not just the endpoints.
for (const viewport of [480,585,640,844,900,1024]) {
  const poses = new Map();
  for (let scroll=0; scroll<=2400; scroll+=3) {
    const p=scenePose(1400,100,scroll,viewport,64,2400);
    assert.ok(p.entry>=0 && p.entry<=1 && p.exit>=0 && p.exit<=1);
    poses.set(scroll,JSON.stringify(p));
  }
  for (let scroll=2400; scroll>=0; scroll-=3) {
    assert.equal(JSON.stringify(scenePose(1400,100,scroll,viewport,64,2400)),poses.get(scroll));
  }
  const reading=scenePose(1400,100,1400-viewport*.5,viewport,64,2400);
  assert.equal(reading.entry,1); assert.equal(reading.exit,0,'centre viewport is a still reading interval');
  const footer=scenePose(2400+viewport-30,28,2400,viewport,64,2400);
  assert.equal(footer.entry,1,'copyright fully settles at the actual document end');
  assert.ok(scenePose(2400+viewport-30,28,2350,viewport,64,2400).entry>0,'footer has a real entrance, not a last-pixel jump');
}
assert.equal(scenePose(300,60,0,900,64,0).entry,1,'short documents start readable');
assert.equal(scenePose(1000,100,1000+100-64,900,64,3000).exit,1);
assert.ok(scenePose(1000,100,990,900,64,3000).exit>0,'return from above retraces the departure');

for (const count of [1,3,5,7,9]) {
  for (let step=0;step<=100;step++) {
    const p=step/100, words=Array.from({length:count},(_,i)=>wordPose(p,i,count,false));
    for(let i=1;i<count;i++)assert.ok(words[i]<=words[i-1],'reading-order wave never overtakes itself');
    assert.equal(wordPose(.9,count-1,count,false),1,'all words settle before arrival/hold');
  }
}
assert.equal(departure(.6),0,'departure waits until most of the panel is covered');
assert.equal(departure(1),1);

const node=()=>({style:{}});
const roles=['intro','warranty','service','returns','focus','patents','trust'];
const scenes=Array.from({length:7},(_,i)=>({slide:node(),role:roles[i],words:Array.from({length:8},node),notes:[node()],pills:i===2||i===5?[node(),node()]:[],marks:i===6?Array.from({length:4},node):[],signature:null}));
context.whyScenes=scenes;context.whySceneMap=new WeakMap(scenes.map(scene=>[scene.slide,scene]));context.reduced={matches:false};
vm.runInContext(source.slice(source.indexOf('  function paintWhy'),source.indexOf("  document.addEventListener('focusin'")),context);
const snapshot=i=>JSON.stringify(scenes[i]);
for(let i=0;i<7;i++) {
  context.paintWhy(scenes[i].slide,i,.68,.2,true); const before=snapshot(i);
  context.paintWhy(scenes[i].slide,i,1,.8,true);context.paintWhy(scenes[i].slide,i,.68,.2,true);
  assert.equal(snapshot(i),before,'all Why-us word/note/pill poses retrace exactly');
  context.paintWhy(scenes[i].slide,i,0,1,false);
  assert.ok(scenes[i].words.every(w=>w.style.opacity==='1.00000'),'flow fallback immediately restores every word');
  assert.ok(scenes[i].marks.every(w=>w.style.opacity==='1.00000'),'hotel marks remain visible in ordinary flow');
}
context.paintWhy(scenes[6].slide,6,.8,0,true);
assert.ok(scenes[6].marks.every((mark,i,marks)=>!i || +mark.style.opacity<=+marks[i-1].style.opacity),'hotel marks arrive in reading order');
context.paintWhy(scenes[6].slide,6,.98,0,true);
assert.ok(scenes[6].marks.every(mark=>mark.style.opacity==='1.00000'),'all four marks settle before the reading position');
context.paintWhy(scenes[1].slide,1,1,1,true);
assert.ok(scenes[1].words.every(w=>w.style.opacity==='1.00000'),'warranty is exempt from added departure effects');
context.paintWhy(scenes[4].slide,4,.4,0,true);
assert.match(scenes[4].words[0].style.transform,/scale\(1\.04000\)/,'100% owns the restrained scale settlement');
context.paintWhy(scenes[4].slide,4,1,0,true);
context.paintWhy(scenes[4].slide,6,.4,0,true);
assert.match(scenes[4].words[0].style.transform,/scale\(1\.04000\)/,'focus keeps its animation after moving to the final slot');
context.paintWhy(scenes[6].slide,4,.8,0,true);
assert.ok(+scenes[6].marks[0].style.opacity>0 && +scenes[6].marks[0].style.opacity<1,'hotel animation follows the scene instead of its old index');
context.reduced.matches=true; context.paintWhy(scenes[4].slide,4,.4,1,true);
assert.equal(scenes[4].words[0].style.opacity,'1.00000');
assert.match(scenes[4].words[0].style.transform,/scale\(1\.00000\)/);
console.log('Reversible scenes: full forward/reverse trips, reading holds, upper-edge returns, footer endpoints, word order, Why-us sequences and reduced/flow fallbacks passed.');
