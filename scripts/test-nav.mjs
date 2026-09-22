// Exercise the production header theme lifecycle without browser timing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('  var topbarMode = null;'),source.indexOf('  var onFrame = function'));
const controls=Array.from({length:5},(_,i)=>({
  dataset:{},getBoundingClientRect:()=>({left:300+i*100,top:20,width:80,height:30})
}));
const topbar={dataset:{},querySelectorAll:()=>controls,
  getBoundingClientRect:()=>({left:0,top:0,bottom:80,height:80,width:1440}),
  setAttribute(name,value){this.dataset[name.slice(5)]=value;}
};
const logo={getBoundingClientRect:()=>({left:20,top:20,width:100,height:40})};
const state={desktop:true,whyTop:-500,whyBottom:8000,content:false};
const foreground={closest:selector=>selector.startsWith('h1') && state.content ? foreground : null};
const surface={dataset:{navTheme:'light',navMode:'glass'},closest(){return this;}};
const context=vm.createContext({
  topbar,menu:{hidden:true},isDesktop:()=>state.desktop,
  window:{innerWidth:1440},
  document:{querySelector:()=>logo,elementFromPoint:()=>surface,elementsFromPoint:()=>[foreground]},
  whyScroll:{getBoundingClientRect:()=>({top:state.whyTop,bottom:state.whyBottom})},
  whyLayout:{animated:true,entrance:900,height:900,prelude:0,stacked:false},
  whySticky:{dataset:{theme:'dark'}},whyLightShift:0,
  whyToneDarkness:()=>.8,
  themeOfSlideAt:x=>x<500?'light':'dark'
});
vm.runInContext(code,context);
const overrides=()=>controls.map(c=>c.dataset.whySurface);
const cleared=()=>assert.ok(overrides().every(v=>v===undefined),'shared surfaces release every individual override');

for(let trip=0;trip<3;trip++) {
  // A slide seam gives the first two links dark ink and the rest white ink.
  context.sampleBelowHeroSurface();
  assert.deepEqual(overrides(),['light','light','dark','dark','dark']);
  // Home's shared dark surface can already be cached when the return happens.
  context.applyTopbarSurface('merge','dark');
  cleared();
  assert.equal(topbar.dataset.theme,'dark');
  context.applyTopbarSurface('merge','dark');
  cleared();
}

// The gradient entrance still owns independent contrast for every control.
state.whyTop=850;
context.whyLightShift=0;
context.sampleBelowHeroSurface();
cleared();
assert.equal(topbar.dataset.mode,'glass','Technology keeps its glass until the actual Why gradient reaches the header');
state.whyTop=100;
context.whyLightShift=-430;
context.sampleBelowHeroSurface();
assert.deepEqual(overrides(),Array(5).fill('dark'));
context.applyTopbarSurface('merge','dark');
cleared();

// Product/Support and Technology switch back to ordinary shared surfaces.
state.whyTop=-500;
context.sampleBelowHeroSurface();
state.whyBottom=-1;
context.sampleBelowHeroSurface();
cleared();
assert.equal(topbar.dataset.theme,'light');
context.applyTopbarSurface('merge','dark');
cleared();
assert.equal(topbar.dataset.theme,'dark');

// Clear backgrounds merge; visible text or imagery enables glass immediately.
context.applyTopbarSurface('merge','dark');
assert.equal(topbar.dataset.mode,'merge');
state.content=true;
context.applyTopbarSurface('merge','dark');
assert.equal(topbar.dataset.mode,'glass','foreground content triggers glass without waiting for Product');
cleared();
state.content=false;
context.applyTopbarSurface('merge','dark');
assert.equal(topbar.dataset.mode,'merge','glass clears again over an empty background');

// Opening the phone menu must also release any leftover desktop overrides.
state.whyBottom=8000;
context.sampleBelowHeroSurface();
state.desktop=false;
context.menu.hidden=false;
context.applyTopbarSurface('merge','light',true);
cleared();
assert.equal(topbar.dataset.mode,'glass');
assert.equal(topbar.dataset.theme,'dark');
console.log('Navigation: repeated Home returns, cached themes, mixed slide contrast, gradient, shared sections and mobile menu passed.');
