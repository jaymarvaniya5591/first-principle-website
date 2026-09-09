# First Principle — Landing Page

Static landing page for First Principle smart toilets, built 1:1 from the Figma design
(`FIRST PRINCIPLE — LANDIN PAGE`, Web 1440px + Mobile 390px frames).

## Stack

- Plain HTML / CSS / vanilla JS — the deployed site has no build step.
- Self-hosted, subset WOFF2 fonts in `assets/fonts` (Anton, Billion Dreams, Helvetica Now Display, Helvetica Neue) with metric-matched local fallbacks (no layout shift).
- Responsive AVIF / WebP / JPEG-PNG images in `assets/img`, generated from the Figma exports and the client renders.

## Structure

```
index.html            # all sections (hero, features, why, collection, contact, footer)
css/styles.css        # source stylesheet: tokens, desktop layout, mobile/tablet (<= 899px)
css/styles.min.css    # minified build of styles.css (this is what index.html loads)
js/main.js            # feature accordion, 6-product carousel, mobile menu, nav scroll-spy, contact form
assets/fonts          # generated woff2 (sources in assets/fonts-src, git-ignored)
assets/img            # generated responsive images (sources in assets/img-src + ../Website Assets)
scripts/              # dev-only asset builders (Node 18+)
vercel.json           # clean URLs, immutable cache for assets, security headers
```

## Editing

- Styles: edit `css/styles.css`, then `npm run css`.
- Fonts: drop source files in `assets/fonts-src`, then `npm run fonts`.
- Images: `npm run images` (reads `assets/img-src` and `../Website Assets`; product photos are picked up from `../Website Assets/Products/<name>.png` — liva, vero, aera, luma fall back to placeholders until supplied).
- `npm run assets` runs all three.

## Local preview

`npm run serve` (or any static server) and open http://localhost:8765.

## Deploy

Vercel, static (framework "Other", no build command). Pushing to `main` deploys production.
