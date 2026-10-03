import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  var hero = document.getElementById("home");'),source.indexOf('  var tech = document.getElementById("technology");'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const early=html.slice(html.indexOf('// One mobile entrance clock'),html.indexOf('</script>',html.indexOf('// One mobile entrance clock')));

function fixture({mobile=true,reduced=false,hidden=false,scroll=0,hash='',font='ready',pending=true}={}) {
  const events={},timers=new Map(),mediaEvents={},classes=new Set();let serial=0,resolveFonts,rejectFonts;
  const fonts=new Promise((resolve,reject)=>{resolveFonts=resolve;rejectFonts=reject;});
  const root={dataset:pending?{phoneTitle:'pending'}:{}};
  const hero={classList:{add:name=>classes.add(name)}};
  const on=(type,fn)=>{(events[type]??=[]).push(fn);};
  const matchMedia=query=>({matches:query.includes('reduced-motion')?reduced:mobile,addEventListener(type,fn){mediaEvents[query.includes('reduced-motion')?'reduced':'mobile']=fn;}});
  const setTimeout=(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;};
  const document={documentElement:root,hidden,getElementById:()=>hero,addEventListener:on,fonts:font==='absent'?null:{load:()=>fonts}};
  const window={matchMedia,setTimeout,clearTimeout:id=>timers.delete(id),addEventListener:on,scrollY:scroll,location:{hash}};
  const context=vm.createContext({window,document,Promise,matchMedia,setTimeout,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)')});
  return {context,root,window,document,mediaEvents,events,timers,classes,resolveFonts,rejectFonts,
    emit:(type,event={})=>(events[type]||[]).forEach(fn=>fn(event)),
    run:()=>vm.runInContext(code,context),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

for (const settings of [{mobile:false},{reduced:true},{}]) {
  const f=fixture({...settings,pending:false});vm.runInContext(early,f.context);
  assert.equal(f.root.dataset.phoneTitle,settings.mobile===false||settings.reduced?undefined:'pending');
  if(f.root.dataset.phoneTitle==='pending') {
    assert.equal([...f.timers.values()][0].ms,1400);
    [...f.timers.values()][0].fn();assert.equal(f.root.dataset.phoneTitle,'static','a missing main script never leaves blank copy');
  }
}
for (const hash of ['', '#home']) {
  const f=fixture({hash});f.run();assert.equal(f.root.dataset.phoneTitle,'pending');
  f.resolveFonts([{}]);await f.flush();assert.equal(f.root.dataset.phoneTitle,'reveal');
  assert.equal([...f.timers.values()][0].ms,1600,'timer starts when fonts resolve, not when the script loads');
  [...f.timers.values()][0].fn();assert.equal(f.root.dataset.phoneTitle,'static');
  assert.ok(f.classes.has('hero--entered'));
}
for (const settings of [{font:'absent'},{reduced:true},{hidden:true},{scroll:100},{hash:'#why-us'}]) {
  const f=fixture(settings);f.run();assert.equal(f.root.dataset.phoneTitle,'static','fallbacks and restoration start settled');
}
for (const reason of ['failed','empty']) {
  const f=fixture();f.run();if(reason==='failed')f.rejectFonts(Error('font unavailable'));else f.resolveFonts([]);
  await f.flush();assert.equal(f.root.dataset.phoneTitle,'static');
}
for (const type of ['pointerdown','touchstart','wheel','keydown','scroll','visibilitychange','pageshow']) {
  for (const ready of [false,true]) {
    const f=fixture();f.run();if(ready){f.resolveFonts([{}]);await f.flush();}
    if(type==='scroll')f.window.scrollY=100;
    if(type==='visibilitychange')f.document.hidden=true;
    f.emit(type,{persisted:true});assert.equal(f.root.dataset.phoneTitle,'static');
    f.resolveFonts([{}]);await f.flush();assert.equal(f.root.dataset.phoneTitle,'static','late font callbacks never restart an interrupted entrance');
    assert.equal(f.timers.size,0);
  }
}
for (const media of ['mobile','reduced']) {
  const f=fixture();f.run();f.mediaEvents[media]({matches:true});f.resolveFonts([{}]);await f.flush();
  assert.equal(f.root.dataset.phoneTitle,'static','breakpoint and preference changes settle immediately');
}
console.log('Hero entrance: shared font readiness, one-time completion, early failure timeout, restored positions, immediate input, hidden tabs and reduced-motion fallbacks passed.');
