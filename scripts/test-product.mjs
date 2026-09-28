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
const status = {};
const buttons = [-1, 1].map(dir => ({
  dataset:{dir:String(dir)},
  addEventListener(type, fn) { this[type] = fn; }
}));
const carousel = {
  dataset:{active:html.match(/class="carousel" data-active="(\d+)"/)[1]},
  querySelectorAll:s => s === '.card' ? cards : buttons,
  querySelector:s => buttons[s.includes('--next') ? 1 : 0],
  addEventListener:(name,fn) => events[name] = fn
};
const context = vm.createContext({
  document:{querySelector:() => carousel, getElementById:() => status}
});
vm.runInContext(source.slice(source.indexOf('  var carousel ='), source.indexOf('  /* Product fits')), context);
const active = () => cards.findIndex(c => c.dataset.pos === 'center');
assert.equal(active(), 0);
assert.equal(status.textContent, 'Showing Novi, 1 of 5');
for (let i = 0; i < 5; i++) {
  buttons[1].click();
  assert.equal(active(), (i + 1) % 5);
  assert.equal(attributes.filter(a => a['aria-hidden'] === 'false').length, 1);
}
for (let i = 0; i < 5; i++) buttons[0].click();
assert.equal(active(), 0, 'both directions wrap to the same initial model');
events.keydown({key:'ArrowLeft',preventDefault(){}});
assert.equal(active(), 4);
events.keydown({key:'ArrowRight',preventDefault(){}});
assert.equal(active(), 0);
events.touchstart({touches:[{clientX:250}]});
events.touchend({changedTouches:[{clientX:120}]});
assert.equal(active(), 1, 'left swipe advances');
events.touchstart({touches:[{clientX:120}]});
events.touchend({changedTouches:[{clientX:250}]});
assert.equal(active(), 0, 'right swipe returns');
events.touchstart({touches:[{clientX:120}]});
events.touchend({changedTouches:[{clientX:130}]});
assert.equal(active(), 0, 'incidental touch movement does not change the product');

// A late upstream layout can enlarge the document before Lenis's observer runs.
// Cancel must synchronize the limit before accepting a native fragment jump.
let controller;
class Lenis {
  constructor() { controller = this; this.actualScroll = 500; this.limit = 500; }
  on() {}
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
