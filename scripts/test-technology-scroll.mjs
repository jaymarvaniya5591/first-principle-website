// Exercise the actual feature-panel wheel handler without depending on animation timing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../js/technology.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf("  body.addEventListener('wheel',"),source.indexOf("  desktop.addEventListener('change'"));
let handler, cancelled=0, scheduled=0;
const inside={}, photo={};
const list={scrollTop:0,clientHeight:400,contains:target=>target===inside};
const desktop={matches:true};
const context=vm.createContext({desktop,list,flow:false,targetScroll:0,revealUntil:100,
  body:{addEventListener:(type,fn)=>{handler=fn;}},
  window:{siteScroll:{cancel(){cancelled++;},by(){throw Error('Panel must never forward to page');}},scrollBy(){throw Error('Panel must never scroll page');}},
  markScrolling(){},maxScroll:()=>600,clamp:(v,max)=>Math.max(0,Math.min(v,max)),schedule(){scheduled++;}
});
vm.runInContext(code,context);
function wheel(delta,options={}) {
  const event={target:inside,deltaY:delta,deltaX:0,deltaMode:0,cancelable:true,defaultPrevented:false,
    preventDefault(){this.defaultPrevented=true;},...options};
  handler(event);return event;
}
assert.ok(wheel(-100).defaultPrevented,'top edge retains upward wheel');
assert.equal(context.targetScroll,0);
assert.ok(wheel(2000).defaultPrevented,'overshoot stays inside list');
assert.equal(context.targetScroll,600);
list.scrollTop=600;
assert.ok(wheel(100).defaultPrevented,'bottom edge retains downward wheel');
assert.equal(context.targetScroll,600);
wheel(-80);assert.equal(context.targetScroll,520,'reverse gesture immediately moves back into list');
const before=cancelled;
assert.equal(wheel(100,{target:photo}).defaultPrevented,false,'photo scroll stays native');
assert.equal(cancelled,before);
assert.equal(wheel(100,{ctrlKey:true}).defaultPrevented,false,'browser pinch/zoom stays native');
assert.equal(wheel(100,{metaKey:true}).defaultPrevented,false);
assert.ok(wheel(0,{deltaX:100}).defaultPrevented,'horizontal panel gestures cannot chain to page');
context.flow=true;list.scrollTop=600;
assert.ok(wheel(100).defaultPrevented,'short-window fallback never forwards overshoot');
assert.equal(list.scrollTop,600);
wheel(-1,{deltaMode:2});assert.equal(list.scrollTop,200,'page-unit wheel stays inside fallback list');
context.flow=false;context.targetScroll=0;list.scrollTop=0;
wheel(2,{deltaMode:1});assert.equal(context.targetScroll,32,'line-unit wheel normalized');
assert.ok(scheduled>0 && cancelled>0,'panel scrolling cancels existing page momentum');
desktop.matches=false;
assert.equal(wheel(100).defaultPrevented,false,'mobile scrolling is unchanged');
console.log('Technology: both boundaries, overshoot, reversal, wheel units, photo exit, modifier zoom, short-window fallback and mobile passed.');
