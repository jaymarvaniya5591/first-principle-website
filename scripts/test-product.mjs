// Catalogue integrity and the actual carousel/scroll controllers; browser QA
// covers typography, image crops and the measured viewport composition.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const articles = [...html.matchAll(/<article class="card"[\s\S]*?<\/article>/g)].map(m => m[0]);
const expected = [
  ['Novi', '19,999', 7], ['Vero', '29,999', 12], ['Aera', '34,999', 12],
  ['Sora', '49,999', 13], ['Liva', '59,999', 13]
];
assert.equal(articles.length, expected.length);
articles.forEach((article, i) => {
  const [name, price, included] = expected[i];
  assert.ok(article.includes(`<h3>${name}</h3>`));
  assert.ok(article.includes(`₹${price}`));
  assert.ok(article.includes(`product-${name.toLowerCase()}-new.jpg`));
  assert.equal((article.match(/class="spec is-/g) || []).length, 13);
  assert.equal((article.match(/aria-label="Included"/g) || []).length, included);
  assert.equal((article.match(/aria-label="Unavailable"/g) || []).length, 13 - included);
});

const events = {}, attributes = expected.map(() => ({}));
const cards = expected.map(([name], i) => ({
  dataset:{index:String(i)},
  setAttribute:(key,value) => attributes[i][key] = value,
  removeAttribute(key) { if(key === 'data-pos') delete this.dataset.pos; },
  querySelector:() => ({textContent:name}), querySelectorAll:() => []
}));
const status = {}, counter = {};
const buttons = [-1, 1].map(dir => ({
  dataset:{dir:String(dir)},
  addEventListener(type, fn) { this[type] = fn; }
}));
const carousel = {
  dataset:{active:html.match(/class="carousel" data-active="(\d+)"/)[1]},
  querySelectorAll:s => s === '.card' ? cards : buttons,
  querySelector:s => s==='.carousel__counter'?counter:buttons[s.includes('--next') ? 1 : 0],
  addEventListener:(name,fn) => events[name] = fn
};
const context = vm.createContext({
  document:{querySelector:() => carousel, getElementById:() => status}
});
vm.runInContext(source.slice(source.indexOf('  var carousel ='), source.indexOf('  /* Product fits')), context);
const active = () => cards.findIndex(c => c.dataset.pos === 'center');
assert.equal(active(), 0);
assert.equal(status.textContent, 'Showing Novi, 1 of 5');
assert.equal(counter.textContent,'01 / 05');
let change;
carousel.onProductChange=value=>{change=value;};
for (let i = 0; i < 5; i++) {
  buttons[1].click();
  assert.equal(active(), (i + 1) % 5);
  assert.deepEqual(JSON.parse(JSON.stringify(change)),{previousIndex:i,index:(i+1)%5,direction:1,source:'button'});
  assert.equal(counter.textContent,String((i+1)%5+1).padStart(2,'0')+' / 05');
  assert.equal(attributes.filter(a => a['aria-hidden'] === 'false').length, 1);
}
for (let i = 0; i < 5; i++) buttons[0].click();
assert.equal(active(), 0, 'both directions wrap to the same initial model');
events.keydown({key:'ArrowLeft',preventDefault(){}});
assert.equal(active(), 4);
assert.equal(change.direction,-1,'keyboard wraparound retains direction');
events.keydown({key:'ArrowRight',preventDefault(){}});
assert.equal(active(), 0);
carousel.changeProduct(1,'drag');
assert.equal(active(),1,'photo drag uses the shared selection operation');
assert.equal(change.source,'drag');
assert.equal(status.textContent,'Showing Vero, 2 of 5');
carousel.changeProduct(-1,'drag');
assert.equal(active(),0);
assert.equal(events.touchstart,undefined,'no duplicate whole-carousel touch listener');
assert.equal(cards.filter(c=>!c.inert).length,1,'only the active product is interactive');


// A late upstream layout can enlarge the document before Lenis's observer runs.
// Cancel must synchronize the limit before accepting a native fragment jump.
let controller;
class Lenis {
  constructor() { controller = this; this.actualScroll = 500; this.limit = 500; }
  on() {}
  stop() {}
  start() {}
  resize() { this.limit = 2000; }
  scrollTo(target) { this.actualScroll = Math.min(target, this.limit); }
}
const window = {Lenis,addEventListener(){}};
const scrollContext = vm.createContext({window,Lenis,
  matchMedia:() => ({matches:true,addEventListener(){}})});
vm.runInContext(readFileSync(new URL('../js/smooth-scroll.js', import.meta.url), 'utf8'), scrollContext);
controller.actualScroll = 1600;
window.siteScroll.cancel();
assert.equal(controller.actualScroll, 1600, 'a fresh product hash is not clamped to the old document height');
controller.limit = 500;
window.siteScroll.to(1800);
assert.equal(controller.actualScroll, 1800, 'a link clicked just after load uses the current document height');
console.log('Product: five catalogue cards, full feature lists, carousel wraparound, keyboard, touch swipes and late-layout fragment navigation passed.');

// The card's viewport budget scales with the full composition. Large/short
// windows and enlarged content must never be cut off by the old 440px ceiling.
const measureCode = source.slice(source.indexOf('  var measureProduct ='), source.indexOf('  var requestProductMeasure ='));
const sizing = {width:1280, height:584, desktop:true, extra:0};
const values = new Map();
const scale = () => sizing.width / 1280;
const section = {style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
const heading = {getBoundingClientRect:()=>({height:42*scale()})};
const body = {};
const measurementContext = vm.createContext({
  window:{get innerWidth(){return sizing.width;}, get innerHeight(){return sizing.height;}},
  collectionMedia:{get matches(){return sizing.desktop;}}, productSection:section,
  productHeader:{getBoundingClientRect:()=>({height:64*scale()})}, productHeading:heading,
  cards:[{querySelector:s=>s==='.card__body'?body:{offsetHeight:(s==='.card__head'?102:247)*scale()+sizing.extra}}],
  getComputedStyle:e=>e===section?{paddingTop:40*scale(),paddingBottom:12*scale()}:e===heading?{marginBottom:20*scale()}:{rowGap:12*scale(),paddingTop:16*scale(),paddingBottom:16*scale()}
});
vm.runInContext(measureCode, measurementContext);
for (const [width,height] of [[1280,584],[1422,649],[1536,701],[1920,876],[960,438]]) {
  sizing.width=width; sizing.height=height;
  measurementContext.measureProduct();
  const cardHeight=parseFloat(values.get('--product-card-height'));
  assert.ok(cardHeight>=400*scale(), 'the content floor scales with the card');
  assert.ok(cardHeight+178*scale()<=height+1, 'the complete composition fits at equivalent zoom sizes');
}
sizing.width=1920; sizing.height=1100;
measurementContext.measureProduct();
assert.equal(parseFloat(values.get('--product-card-height')),660,'large displays do not keep the old fixed card ceiling');
sizing.height=450; sizing.extra=100;
measurementContext.measureProduct();
assert.ok(parseFloat(values.get('--product-card-height'))>660,'content can grow past the preferred maximum');
sizing.desktop=false;
measurementContext.measureProduct();
assert.equal(values.has('--product-card-height'),false,'switching to mobile releases the desktop height');
console.log('Product scaling: zoom-equivalent viewports, large screens, short windows, enlarged content and mobile reset passed.');

// All Product entry points share an offset that balances the heading gaps.
const destinationCode = source.slice(source.indexOf('  var productDestination ='), source.indexOf('  var measureProduct ='));
const anchorSection = {getBoundingClientRect:()=>({top:1000})};
const anchorContext = vm.createContext({window:{scrollY:500},
  productSection:anchorSection, productHeading:heading,
  productHeader:{getBoundingClientRect:()=>({height:64*scale()})},
  collectionMedia:{get matches(){return sizing.desktop;}},
  getComputedStyle:e=>e===anchorSection?{paddingTop:40*scale()}:{marginBottom:20*scale()}
});
vm.runInContext(destinationCode,anchorContext);
sizing.desktop=true;
for (const width of [960,1280,1422,1920]) {
  sizing.width=width;
  const destination=anchorContext.productDestination();
  const headingTop=1500-destination+40*scale();
  assert.ok(Math.abs(headingTop-64*scale()-20*scale())<.001,'heading top gap equals the card gap at every scale');
}
sizing.desktop=false;
assert.equal(anchorContext.productDestination(),1500-64*scale()+40*scale()-12,'mobile heading keeps its 12px clearance despite section padding');
console.log('Product anchors: balanced desktop heading gaps and mobile section clearance passed.');
