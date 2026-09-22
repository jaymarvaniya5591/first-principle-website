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
css/styles.css        # source stylesheet, loaded by index.html
css/styles.min.css    # equivalent minified distribution stylesheet
js/main.js            # feature accordion, 6-product carousel, mobile menu, nav scroll-spy, contact form
scripts/serve.mjs     # local-only preview on port 5592
assets/fonts          # generated woff2 (sources in assets/fonts-src, git-ignored)
assets/img            # generated responsive images (sources in assets/img-src + ../Website Assets)
scripts/              # dev-only asset builders (Node 18+)
vercel.json           # clean URLs, immutable cache for assets, security headers
```

## Editing

- Styles: edit `css/styles.css`, then `npm run css`.
- Fonts: drop source files in `assets/fonts-src`, then `npm run fonts`.
- Images: `npm run images` (reads `assets/img-src` and `../Website Assets`; product photos are picked up from `../Website Assets/Products/<name>.png` — liva, vero, aera, luma fall back to placeholders until supplied).
- `npm run assets` rebuilds fonts, images, clouds, and CSS.

## Responsive layout

The design reference is commit `2416abf` at a 1280 × 585 CSS viewport, matching
the supplied 150% Windows / 100% Chrome screenshot. The measured content artboard
is 1264.666667 × 585.333333 CSS pixels. These are design coordinates; there is no
OS, display, or device-pixel-ratio detection in the website.

- Desktop starts at 1100 CSS pixels. The hero artboard and header frame share a
  1897px maximum width (1.5× the reference). Container units scale all internal
  dimensions together. The text column, combined toilet/rock asset and SVG fog
  retain the reference geometry; entrance transforms are on separate children.
- The page backdrop fills the sticky pane. On taller windows the hero artboard
  stays anchored at the bottom, moving the copy, product and fog as one group.
  Short desktop windows use ordinary scrolling so the complete poster remains
  reachable. The Cloud to Clarity transition runs where the pane fits.
- Below 1100px, copy and product use normal-flow rows. Below 600px the compact
  typography applies; tablet layouts use a wider reading measure. Section headers
  stack between 1100px and 1200px when both desktop labels cannot fit safely.
- Root font size is stable. Non-hero desktop dimensions preserve their measured
  reference values; constrained grid/flex layouts handle available space.
- The cloud envelope is baked into the SVG by `npm run clouds`. Runtime code only
  pauses/resumes cloud animation; it does not measure or reposition the artwork.
- `npm run css` uses esbuild because the previous minifier dropped range media
  queries. Rebuild the minified file after every source stylesheet edit.
- `npm run test:clouds` checks logo clearance, smooth mask geometry, embedded
  artwork, transparent edges and the opaque fog seal without browser JavaScript.

## Hero to Technology: Cloud to Clarity

This repository contains the approved desktop and mobile Cloud to Clarity design.

The desktop and mobile transition uses a short sticky hero beneath the incoming white
Technology section. Its feathered edge belongs to the section, so cloud and
content travel together with native scrolling. The existing cloud artwork adds
a little texture, which dissolves as the section approaches the top.

- One viewport of scrolling takes the hero to Technology. The hero's 180svh
  layout and the section's -80svh overlap provide the sticky runway.
- Mobile uses the same exposure curves, feathered edge and heading reveal.
  Its existing composition keeps its intrinsic height, with an added 80svh
  runway. Taller content scrolls into view before the bottom of the scene pins.
  A ResizeObserver keeps the scene measurement current after fonts or rotation;
  stable viewport units keep browser-toolbar changes from shifting the lighting.
- The hero shifts upward subtly. The heading and supporting line resolve over
  22px and 16px respectively, driven by the same physical section boundary.
- Scroll gradually desaturates the outgoing hero, deepens contrast and drops
  the sky into black. Foreground details fade separately into those shadows,
  avoiding a uniform grey wash. The incoming section's paper surface brightens
  to pure white. These position-based curves reverse together; the original
  hero is fully restored at the top. The grade uses no blur.
- Navigation switches contrast as the white surface arrives and highlights
  Technology when it occupies the majority of the viewport.
- No WebGL, new image assets or full-page transform wrapper.
- Desktop wheel input uses locally vendored Lenis 1.3.26 (MIT). The settings
  in js/smooth-scroll.js use frame-rate-independent damping, a soft limit on
  large wheel impulses, and immediate cancellation of stale momentum when
  direction reverses. Anchor links and the Why-us skip button use the same
  controller and release their temporary state if interrupted. Touch and
  reduced-motion input remain native; crossing below 1100px destroys Lenis.
- Desktop motion applies at >=1100px wide, >=521px high, with an aspect ratio
  at or below 11/5 and no reduced-motion preference. Shorter/wider windows and
  reduced motion get the ordinary document flow. Mobile motion applies below
  1100px with at least 521px of height and no reduced-motion preference. Touch
  scrolling keeps the browser's native inertia. Short landscape screens retain
  ordinary flow. Without JavaScript, desktop content remains visible.
- Main implementation: the Cloud to Clarity block at the end of css/styles.css
  and the shared scroll frame in js/main.js. Rebuild CSS with npm run css.

For visual regression, compare the reference viewport with fonts loaded and the
entrance animations settled. Use `?clouds=still` on localhost to pause ambient
cloud movement. Check both viewport dimensions and device pixel ratio; DPR alone
does not reproduce the layout effects of Windows scaling or browser zoom.

## Local preview

`npm run serve` (or any static server) and open http://localhost:5592.

The preview binds only to this computer. Set PORT to use another local port.

## Deploy

Vercel, static (framework "Other", no build command). Pushing to `main` deploys production.
