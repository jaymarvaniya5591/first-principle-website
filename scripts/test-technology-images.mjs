import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run the shipped image preparation/selection functions with controlled network
// completion. Slow loads must not become a new wait after a prefetched-card tap.
const source=readFileSync(new URL('../js/technology.js',import.meta.url),'utf8');
const preparation=source.slice(source.indexOf('  function prepare('),source.indexOf('  function showImage('));
const mobile=source.slice(source.indexOf('  function mobilePicture('),source.indexOf('  function releaseAnchor('));
function fixture(saveData=false) {
  let layoutReads=0, finishes=0, sizes=0;
  const images=[];
  const photos=Array.from({length:7},(_,index)=>{
    const classes=new Set();
    const photo={hidden:false,picture:null,classes,
      classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
      appendChild(fragment){this.picture=fragment;},
      querySelector(selector){
        if(selector==='picture')return this.picture;
        assert.equal(selector,'template');
        return {content:{cloneNode(){
          const img={src:`feature-${index}.jpg`,currentSrc:'',loading:'lazy',calls:0,pending:[],
            decode(){this.calls++;return new Promise((resolve,reject)=>this.pending.push({resolve,reject}));}};
          images[index]=img;
          return {querySelector:()=>img};
        }}};
      }
    };
    return photo;
  });
  const context=vm.createContext({prepared:new WeakMap(),mobilePhotos:photos,
    mobileNear:false,mobileActive:0,mobileRequest:0,desktop:{matches:false},document:{hidden:false},
    navigator:{connection:{saveData}},
    cards:photos.map(()=>({getBoundingClientRect(){layoutReads++;return {top:100,bottom:500};}})),
    mobileBounds:()=>({top:64,bottom:800}),sizeMobilePhoto(){sizes++;},
    finishDetail(){finishes++;},moveMobileView(){},mobileDestination:()=>100
  });
  vm.runInContext(preparation+mobile,context);
  return {context,photos,images,reads:()=>layoutReads,finishes:()=>finishes,sizes:()=>sizes};
}
async function flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
const f=fixture(),c=f.context;
c.warmMobileImages();assert.equal(f.images.length,0,'leave hero loading alone before Technology approaches');
c.mobileNear=true;c.document.hidden=true;c.warmMobileImages();assert.equal(f.images.length,0);
c.document.hidden=false;c.desktop.matches=true;c.warmMobileImages();assert.equal(f.images.length,0,'mobile prefetch does not load on desktop');
c.desktop.matches=false;c.warmMobileImages();
assert.equal(f.images.length,7,'all seven pictures prepare before the user taps');
assert.ok(f.images.every(img=>img.loading==='eager'&&img.calls===1),'prefetch includes hidden cards, without duplicate decode work');
const promise=c.prepare(f.photos[2].picture);
assert.equal(c.prepare(f.photos[2].picture),promise,'in-flight preparation is shared');
f.images.forEach((img,i)=>{img.currentSrc=`feature-${i}.avif`;img.pending.shift().resolve();});
await flush();
c.mobileActive=3;c.loadMobileImage(3);
assert.ok(f.photos[3].classes.has('is-ready'),'a prepared photo is ready synchronously on tap');
assert.equal(f.images[3].calls,1,'browser source selection does not invalidate a completed prefetch');
assert.equal(f.reads(),0,'prepared-image selection does not force another geometry pass');
c.loadMobileImage(3);assert.equal(f.images[3].calls,1,'reopening never clears a prepared image');

// Responsive source changes require a new decode, and stale errors cannot hide
// a different selected card or interrupt its current opening animation.
f.images[3].currentSrc='feature-3-large.avif';c.loadMobileImage(3);
assert.equal(f.images[3].calls,2);
c.mobileActive=4;c.loadMobileImage(4);
f.images[3].pending.shift().reject(new Error('interrupted responsive source'));
await flush();assert.equal(f.photos[3].hidden,false);assert.equal(f.photos[4].hidden,false);
assert.equal(f.finishes(),0,'stale completion does not cancel the new card animation');
c.mobileActive=3;c.loadMobileImage(3);assert.equal(f.images[3].calls,3,'a rejected decode is not cached forever');
f.images[3].pending.shift().reject(new Error('image unavailable'));
await flush();assert.equal(f.photos[3].hidden,true,'failed image leaves readable content without an empty frame');
c.loadMobileImage(3);f.images[3].pending.shift().resolve();await flush();
assert.equal(f.photos[3].hidden,false);assert.ok(f.photos[3].classes.has('is-ready'));
assert.equal(f.sizes(),1,'a recovered photo is fitted back into the visible card');

const lean=fixture(true);lean.context.mobileNear=true;lean.context.warmMobileImages();
assert.equal(lean.images.filter(Boolean).length,1,'data-saving preference loads only the open feature');
lean.context.mobileActive=5;lean.context.loadMobileImage(5);
assert.equal(lean.images.filter(Boolean).length,2,'explicit selection still loads the requested photo');
console.log('Technology images: advance preparation, synchronous ready-state, source selection, deduplication, rapid switches, failure recovery, data saving and visibility passed.');
