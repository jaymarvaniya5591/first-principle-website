import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file => readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const data=JSON.parse(read('data/product-specifications.json'));
const expected={novi:39999,vero:59999,aera:59999,sora:124999,liva:134999,luna:249999};
const home=read('index.html');
for (const [slug,price] of Object.entries(expected)) {
  const product=data.products.find(p=>p.slug===slug);
  assert.equal(product.priceINR,price,`${slug}: approved price`);
  const html=read(`specifications/${slug}/index.html`);
  assert.ok(html.includes(`href="https://getfirstprinciple.com/specifications/${slug}"`));
  assert.ok(html.includes(`<h1 id="product-name">${product.name}</h1>`));
  assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
  assert.ok(!/<script\b/.test(html),'specifications render without JS');
  assert.ok(!/₹|Warranty|View all 13 features/.test(html),'no commercial/feature blocks');
  for (const target of Object.keys(expected)) assert.ok(html.includes(`href="/specifications/${target}"`));
  if(slug==='luna') {
    assert.ok(html.includes('Coming soon.'));
    assert.ok(!html.includes('<dl')&&!html.includes('section-nav'));
  } else {
    for(const id of ['ceramic','plumbing','electrical']) assert.ok(html.includes(`id="${id}"`));
    assert.ok(html.includes('&lt;0.20%')&&html.includes('650–700 kg/cm²'));
    assert.ok(home.includes(`href="/specifications/${slug}"`));
  }
}
const model=slug=>data.products.find(p=>p.slug===slug);
const value=(slug,group,label)=>model(slug)[group].find(row=>row[0]===label)?.[1];
assert.equal(value('novi','ceramic','Net weight'),'34 kg');
assert.equal(value('aera','ceramic','Net weight'),undefined);
assert.equal(value('liva','plumbing','Rough-in distance'),'180 mm');
assert.equal(value('liva','ceramic','Pan dimensions (L × W × H)'),'600 × 370 × 360 mm');
assert.equal(value('vero','plumbing','Minimum water pressure'),'0.02 MPa at the inlet');
assert.equal(value('aera','electrical','Power supply'),'220 V · 50 Hz');
assert.ok(home.includes('Smart toilets starting at ₹39,999.'));
assert.ok(home.includes('Starting from <strong>&#8377;39,999'));
assert.equal((home.match(/class="card__technical"/g)||[]).length,5);
assert.ok(!read('sitemap.xml').includes('vercel.app'));
console.log('Six routes, approved data, missing-field handling, Luna state, metadata, prices and product links passed.');
