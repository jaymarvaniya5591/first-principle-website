import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await readFile(path.join(root, 'data/product-specifications.json'), 'utf8'));
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections = [
  ['ceramic', '01', 'Ceramic & construction', 'Ceramic'],
  ['plumbing', '02', 'Plumbing & installation', 'Plumbing'],
  ['electrical', '03', 'Electrical & power', 'Electrical']
];
const route = product => `/specifications/${product.slug}`;
const rows = entries => `<dl class="spec-list">${entries.map(([label,value,note]) => `
  <div class="spec-row"><dt>${escape(label)}</dt><dd>${escape(value)}${note ? `<span class="spec-note">${escape(note)}</span>` : ''}</dd></div>`).join('')}
</dl>`;
const ceramicComparison = () => `<table class="ceramic-comparison" aria-labelledby="material-performance-heading">
  <thead><tr><th scope="col" class="property-column">Ceramic property</th><th scope="col">I.S.I. requirement</th><th scope="col">Our value</th></tr></thead>
  <tbody>${data.sharedCeramicPerformance.map(({property,requirement,value,note}) => `
    <tr><th scope="row">${escape(property)}${note ? `<span class="spec-note">${escape(note)}</span>` : ''}</th><td>${escape(requirement)}</td><td>${escape(value)}</td></tr>`).join('')}
  </tbody>
</table>`;
const brand = `<a class="brand" href="/" aria-label="First Principle home"><img src="/assets/img/logo-mark-footer.svg" width="40" height="40" alt=""><span>First<br>Principle</span></a>`;

function page(product) {
  const pending = product.status === 'coming-soon';
  const description = pending ? 'Luna technical specifications. Coming soon.' : `${product.name} technical specifications: ceramic construction, plumbing and installation, electrical requirements and power.`;
  return `<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(product.name)} — Technical specifications | First Principle</title>
  <meta name="description" content="${escape(description)}">
  <meta name="theme-color" content="#242424">
  <meta name="color-scheme" content="dark">
  <link rel="canonical" href="${data.origin}${route(product)}">
  <meta property="og:title" content="${escape(product.name)} — Technical specifications">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${data.origin}${route(product)}">
  <meta property="og:site_name" content="First Principle">
  <link rel="icon" href="/assets/img/logo-mobile.svg" type="image/svg+xml">
  <link rel="preload" href="/assets/fonts/helvetica-neue-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/specifications.css">
</head>
<body>
  <a class="skip-link" href="#main">Skip to specifications</a>
  <header class="site-header wrap">${brand}<a class="back-link" href="/#product"><span aria-hidden="true">←</span> Back to collection</a></header>
  <main id="main" tabindex="-1">
    <div class="wrap">
      <section class="product-intro" aria-labelledby="product-name">
        <div><p class="eyebrow">Technical specifications</p><h1 id="product-name">${escape(product.name)}</h1>${pending ? '' : `<p class="product-type">${escape(product.description)}</p>`}</div>
        ${pending ? '' : '<p class="intro-note">For those who<br> love numbers.</p>'}
      </section>
      <nav class="model-nav" aria-label="Product models">${data.products.map(p => `<a href="${route(p)}"${p.slug === product.slug ? ' aria-current="page"' : ''}>${escape(p.name)}</a>`).join('')}</nav>
    </div>
    ${pending ? '<section class="coming-soon wrap" aria-label="Availability"><p>Coming soon.</p></section>' : `
    <nav class="section-nav" aria-label="Specification sections"><div class="wrap">${sections.map(([id,num,title,short]) => `<a href="#${id}"><span aria-hidden="true">${num}</span> ${short}</a>`).join('')}</div></nav>
    <div class="wrap spec-sections">${sections.map(([id,num,title]) => `
      <section class="spec-section" id="${id}" aria-labelledby="${id}-heading">
        <header class="section-heading"><span class="section-number" aria-hidden="true">${num}</span><h2 id="${id}-heading">${escape(title)}</h2></header>
        <div class="section-data">${rows(product[id])}${id==='ceramic' ? `<h3 class="subheading" id="material-performance-heading">Material performance</h3>${ceramicComparison()}` : ''}</div>
      </section>`).join('')}
    </div>`}
  </main>
  <footer class="site-footer wrap"><div><p class="footer-heading">A detail to clarify?</p><p class="footer-note">Talk to us directly.</p></div><div class="contact-links"><a href="mailto:founder@getfirstprinciple.com">founder@getfirstprinciple.com</a><a href="tel:+919071531867">9071531867</a></div><a class="top-link" href="#main">Back to top <span aria-hidden="true">↑</span></a></footer>
</body>
</html>
`;
}

for (const product of data.products) {
  const folder = path.join(root, 'specifications', product.slug);
  await mkdir(folder, {recursive:true});
  await writeFile(path.join(folder, 'index.html'), page(product));
}

// Keep existing homepage composition and controllers intact. Match prices by
// product name, since two models now intentionally have the same price.
const homePath = path.join(root, 'index.html');
let home = await readFile(homePath, 'utf8');
home = home.replace(/<article class="card"[\s\S]*?<\/article>/g, article => {
  const product = data.products.find(p => article.includes(`<h3>${p.name}</h3>`));
  if (!product) throw new Error('Unknown product card');
  article = article.replace(/(<p class="card__amount">)[\s\S]*?(<\/p>)/, `$1₹${product.priceINR.toLocaleString('en-IN')}$2`);
  const link = `<a class="card__technical" href="${route(product)}" aria-label="${product.name} technical specifications">Technical specifications <span aria-hidden="true">↗</span></a>`;
  article = article.replace(/\s*<a class="card__technical"[\s\S]*?<\/a>/g,'');
  return article.replace(/(<div class="card__price">[\s\S]*?<\/div>)/, `$1\n              ${link}`);
});
const lowest = Math.min(...data.products.filter(p => p.status==='available').map(p => p.priceINR)).toLocaleString('en-IN');
home = home.replace(/(Smart toilets starting at ₹)[\d,]+/g,`$1${lowest}`)
  .replace(/(Explore the products, starting from ₹)[\d,]+/g,`$1${lowest}`)
  .replace(/((?:From|Starting from) <strong>&#8377;)[\d,]+/g,`$1${lowest}`)
  .replaceAll('https://first-principle-website-nine.vercel.app',data.origin);
await writeFile(homePath,home);
await writeFile(path.join(root,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${data.origin}/</loc></url>\n${data.products.map(p=>`  <url><loc>${data.origin}${route(p)}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Built ${data.products.length} specification routes and synchronized homepage prices.`);
