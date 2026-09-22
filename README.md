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
js/main.js            # 6-product carousel, mobile menu, nav scroll-spy, contact form
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
- Root font size is stable. Technology has its own proportional reference unit
  (see below); other non-hero sections use constrained grid/flex layouts.
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

## Desktop technology explorer

Technology uses the approved 1280×585 CSS viewport as a proportional reference,
matching the 150% Windows / 100% Chrome view. Like the hero's scene unit, one
`--technology-unit` scales all type, spacing, padding and controls together. It
equals the section's measured content width divided by 1280; no OS, zoom or DPR
detection is used. At reference size the heading/card/description/supporting
type is 36/20/15/17px, with equal 20px gaps above and below the heading. These
values scale continuously; there is no abrupt short-window typography override.

The full-width 46/54 grid aligns the heading and supporting line over their
respective panels. The section measures the actual header and heading heights,
then fits five row units into the remaining viewport. The photo and cards share
the bottom edge with no bottom padding or height cap. One card starts expanded
and takes exactly two row units; each other card takes one. If less than 340
reference units of panel height remain, the list uses readable document flow.

The explorer applies at 1100px and above, and also on landscape mouse/trackpad
windows at least 600px wide with an aspect ratio of at least 4:3. This prevents
Windows scaling or Chrome zoom from turning a laptop into the touch accordion.
Phones, touch tablets below 1100px, and narrow portrait windows use the
mobile accordion described below. The JS, CSS and responsive image sizes
share this layout condition. A small photo hint fades after the first interaction.

The original typography mix is retained: Helvetica Neue for headings and feature
titles, Helvetica Now Display for descriptions and other body copy, and Helvetica
Now Text for navigation. The Technology heading uses slightly relaxed tracking
(-0.02em). The hero retains its original font families and layout.

`js/technology.js` owns hover/focus/click selection, decoded image swaps, and internal
scrolling. The first card opens by default. Desktop always keeps one card open:
scrolling, leaving a card, clicking it again, or pressing Escape does not collapse
it. Selecting a different card replaces it and its image. Hover selection requires
actual pointer movement so animated or scrolling rows cannot select themselves
under a stationary cursor. Mobile has an independent selection starting with the first feature open.

Desktop wheel input over the cards scrolls their panel, releasing excess to the
page at either end. The entire photo scrolls the page normally, including its
edge beside the cards. There is no mixed zone or photo-specific slowdown.
Internal card scrolling activates only while the complete panel
fits below the navigation and above the viewport bottom. During entry from the
hero or return from the next section, wheel input moves only the page until the
panel is fully visible. This also applies with reduced motion, without Lenis.
The existing Lenis controller's relative-scroll API handles page movement without processing the
same wheel event twice. Zoom gestures and horizontal input remain native.

Technology nav clicks and direct fragment links share the measured header offset,
including scaled desktop windows below the site's navigation breakpoint.
Resizing or zooming while aligned at Technology keeps that entrance below the
header as the hero above changes height; it does not pull back a departing user.
Reduced motion removes interpolation. Without JavaScript the desktop list and
descriptions remain in normal flow. Rebuild CSS after changing the source.

## Mobile technology overview

The same Technology controller switches to a native-scrolling overview on touch
and narrow layouts. The first feature opens by default, with its photo above
its title and description; there is no duplicate introductory image. The other
six rows start closed. Content is centered within 600px on tablets. Type uses rem units, natural
wrapping, and the existing Helvetica pairing. The hero transition is unchanged.

Only a row's header toggles its description and inline photo. One row can be open
at a time, and tapping it again closes it. Switching rows first compensates for
an earlier row closing, then moves only enough to reveal the complete selected
card. An already visible card stays put. Images use less height on short screens,
without shrinking text; if enlarged text still cannot fit, the title is aligned
below navigation with normal scrolling available. The explicit Next feature
action aligns the next card below navigation. A subtle exploration hint and one
skip link sit above the list; there is no redundant link at the bottom.
Viewport assistance lasts 180ms, is interrupted by new input, and is immediate
with reduced motion. Browser toolbar height changes do not resize images during
a swipe; the next selection uses the current visual viewport. No mobile wheel routing,
internal list scrolling, hover selection, or scroll-driven feature changes run.

The first image loads as the section approaches. Other detail images live in inert templates until selected, then use the existing
responsive AVIF/WebP/JPEG assets and decode before fading in. Request tokens
discard stale completion callbacks. Failed images remove their reserved frame
while leaving descriptions and navigation available. Expansion takes 180ms,
interrupts on new input, and becomes immediate with reduced motion. Closed
regions are hidden and inert; buttons retain their original IDs and controls.
Desktop and mobile selections survive layout changes independently.

## Laptop Why us

The laptop presentation uses Technology's desktop query, including scaled
landscape fine-pointer windows. Its black introduction reads "Why First
Principle?", with a dim "Why" and a white brand name. The existing 81.777px
slide title and 28.444px note sizes are retained. The introduction note is
sentence case, max-width 720px, line-height 1.4, with a 32px title gap. "We’re here." is softly highlighted in white.

Technology has its own 48-unit white bottom feather, based on measured content
width / 1280. It covers both photo and cards and never captures pointer input.
A 2px white overdraw closes fractional panel seams; the feature hint sits
42 units from the photo bottom in a translucent glass block, with a fine white
border and static 10px backdrop blur. This lowers it 18 units without putting
its text inside the opaque bottom feather.

The separate Why wash travels over one viewport height (88vh overlap plus
12vh prelude). The prelude is 80% shorter; entrance travel is 20% shorter.
The headline fades in and rises 48px through the last 60% of the entrance.
The supporting line follows through the last 50%, fading in and rising 24px.
Both finish at the settled introduction and retrace on reverse scroll. Direct
Why links show settled text; motion/fit fallbacks expose it immediately. This
text-only animation is independent of the approved gradient and runway.

The gradient is a single opaque colour surface: actual white, greys and #111,
not a black mask over the photo. This fixes the muddy early darkening and the
intro background hiding the lower gradient. The intro is transparent only in
the horizontal presentation; its text remains above the gradient plane.

The plane begins 8vh before Technology's bottom with a feather into white.
Its neutral ramp spans 58vh, sampled at 65 points along a smooth Oklab-lightness
curve. It extends into the intro, preserving intermediate greys without adding
any document height. Scroll moves the plane up by 50vh*smoothstep(progress).
The ramp finishes 4vh above the viewport at pinning, leaving exact #111 behind
the settled introduction. Reverse scrolling retraces the same geometry.

Navigation samples that same colour curve and transformed position. Static
neutral dithering at 0.4%, gated by 4*d*(1-d), softens rendering bands while
leaving the white and black endpoints clean. There are no moving lines,
animated blur, autonomous animation, extra inertia or new dependencies.
Rebuild the noise tile with `node scripts/build-why-noise.mjs` and CSS with
`npm run css`.

Design research: United Carriers' continuous gradient entrance (live site),
Awwwards' MICA RINO background-transition reference, and W3C guidance on
perceptual colour interpolation. The flat monochrome treatment is our adaptation:
- https://unitedcarriers.com/
- https://www.awwwards.com/inspiration/background-transition-mica-rino
- https://www.w3.org/TR/css-color-4/#interpolation-space

Desktop order is introduction, warranty, in-house service, returns, specialist
focus, patents: dark/light alternating. Existing benefit article nodes are
reordered and their original order/themes restored on mobile. The introduction
is display:none outside the laptop query, including without JavaScript.

Each horizontal journey takes 1.6 viewport heights, with 0.2 viewport heights
held at both ends. Six slides occupy 9.4 viewport heights including the sticky
screen, plus the 12vh entrance prelude. Measured slide offsets drive travel and
arrow-key destinations. Desktop Why links land on the settled introduction.
Skip and anchor journeys remain interruptible; resize preserves entrance or
slide progress. Reduced motion, short windows and content that does not fit
use ordinary vertical flow. Without JavaScript the static desktop introduction
and all five benefits remain readable in source order, without the wash.

Run `npm run test:why` for controller regressions: gradient endpoints,
monotonicity, reveal, pacing, holds, reversal, arrows, resize, motion/fit fallbacks,
mobile restoration and interrupted Skip. Browser checks cover 1280x585,
1366x768, 1440x900 and 1024x600; 390x844 and 768x1024 are compared with the
original mobile/tablet layout and visible reading order.

## Local preview

`npm run serve` (or any static server) and open http://localhost:5592.

The preview binds only to this computer. Set PORT to use another local port.

## Deploy

Vercel, static (framework "Other", no build command). Pushing to `main` deploys production.
