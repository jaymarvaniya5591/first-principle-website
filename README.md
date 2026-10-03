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
js/main.js            # 5-product carousel, mobile menu, nav scroll-spy, contact form
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
  (see below); Product, Support and Footer share a 1280px proportional unit.
  Their type, spacing, card sizes and content widths grow together with the viewport.
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
- The header starts with Home's merge/dark surface in HTML, so the white logo
  is correct before deferred JavaScript runs. The first runtime measurement still
  updates contrast for restored scroll positions and direct section links.
- Desktop glass appears when the incoming cloud reaches the header or visible
  text/imagery passes beneath it; plain hero sky stays clear. The Why gradient
  takes over header styling only when its actual surface reaches the bar.
  Individual Why-slide ink overrides are cleared on every return to a shared
  section theme, including direct Home links. `npm run test:nav` covers these
  resets, glass activation and the transition boundary.
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

Desktop wheel input over the cards stays inside their panel, including overshoot
at either end and gestures while the panel is partly visible. There is no
handoff to page scrolling. The entire photo and areas outside the list scroll
the page normally. CSS scroll containment and the desktop-only Lenis exclusion
also prevent native chaining; modifier zoom gestures remain native. Mobile
scrolling is unchanged. Run `npm run test:technology-scroll` for boundary,
reversal, input-unit, photo, modifier and fallback routing checks.

Technology nav clicks and direct fragment links share the measured header offset,
including scaled desktop windows below the site's navigation breakpoint.
Resizing or zooming while aligned at Technology keeps that entrance below the
header as the hero above changes height; it does not pull back a departing user.
Reduced motion removes interpolation. Without JavaScript the desktop list and
descriptions remain in normal flow. Rebuild CSS after changing the source.

## Mobile technology overview

Below 600px, the introduction uses a two-line 2rem heading, 20px side gutters,
3.5rem top spacing and 2rem before the cards. Touch tablets use 2.5rem headings.
Collection, Why-us and Support share the same heading family, scale, 1.15 line
height and -0.02em tracking. The first feature remains open. Technology ends at
the last feature's bottom border, without trailing padding. Desktop typography
and the hero-to-Technology Cloud to Clarity transition are unchanged.

On phones, the four hotel logos form a quiet, always-visible row above the hero
title, without the "Specified by" label or a disclosure. Tablet and desktop
retain the original rail. The layout also works without JavaScript.

The same Technology controller switches to a native-scrolling overview on touch
and narrow layouts. "No Bad Smells. Ever." is first and opens by default on both
desktop and mobile. On mobile it appears with its title and
description above its photo; there is no duplicate introductory image. The other
six rows start closed. Content is centered within 600px on tablets. Type uses rem units, natural
wrapping, and the existing Helvetica pairing. The hero transition is unchanged.

Only a row's header toggles its description and inline photo. One row can be open
at a time, and tapping it again closes it. Switching rows first compensates for
an earlier row closing, then moves only enough to reveal the complete selected
card. An already visible card stays put. Images use less height on short screens,
without shrinking text; if enlarged text still cannot fit, the title is aligned
below navigation with normal scrolling available. There are no Next feature
buttons; visitors select the feature headings directly.
Viewport assistance lasts 180ms, is interrupted by new input, and is immediate
with reduced motion. A shrinking viewport resizes the image and keeps an already
visible card in view; growing viewport space does not enlarge it mid-swipe.
Every selection uses the current visual viewport. No mobile wheel routing,
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

Technology ends at a crisp boundary on both laptop and mobile. On laptops the white mist
belongs to the Why-us transition: it stays clipped at rest and is released
smoothly during boundary departure, retracing on reverse scrolling. The feature
hint retains its translucent glass block, fine white border and static backdrop blur.

The desktop Why wash travels over one viewport height and overlaps the
full viewport. Mobile has an opaque, straight-edged black introduction with no wash or prelude.
The title reveals through two clipped phrase windows: "Why" from 42–90% of the
entrance, then "First Principle?" from 48–96%, with cubic ease-out. Each phrase
rises from below its baseline while becoming fully opaque. Padding protects
descenders; negative margins preserve the settled headline size and position.
The reassurance follows at 62–100%, fading in and rising 24px. All movement is
scroll-linked and retraces on reversal, with no independent clock or blur.
Direct Why links show settled text; motion/fit fallbacks expose it immediately.
The gradient colours, scroll runway and typography are preserved.

The gradient is a single opaque colour surface: actual white, greys and #111,
not a black mask over the photo. This fixes the muddy early darkening and the
intro background hiding the lower gradient. The intro is transparent only in
the horizontal presentation; its text remains above the gradient plane.

The plane begins 5.6vh before Technology's bottom with a feather into white.
Its desktop neutral ramp spans 60.9vh, exactly three times the previous 20.3vh
white-to-black window. It uses 257 Oklab-lightness samples, preserving the
approved colours and relative spacing while adding intermediate shades. Desktop
stop positions are 5.6 + 87*(0.4*t + 0.3*t*t) vh; the feather plus ramp is 66.5vh.
The gradient is generated lazily on desktop; mobile clears its surface variables.
Desktop scroll runway and title reveal are unchanged; the feather belongs only to the departing transition.
Scroll moves the plane up by 50vh*smoothstep(progress). At pinning the desktop
ramp's final shadow extends 10.9vh into the introduction, clearing during the
20vh opening reading hold.
Reverse scrolling retraces the same geometry. Navigation and grain masks use
the desktop profile. Mobile navigation samples the actual opaque card boundary.

The laptop introduction stays centred in its screen. Removing the 12vh prelude
brings the entire screen closer to Technology instead of lifting its text.
The unchanged 60.9vh gradient can extend into the transparent introduction;
ordinary-flow fallbacks expose the complete content without the decorative plane.

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
screen, without a desktop entrance prelude. Measured slide offsets drive travel and
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


### Product, Support and Footer scaling

The approved 1280 × 584 composition is the reference. `--collection-unit` scales
all desktop dimensions together; Product's measured height budget also scales its
400–440px reference range and expands for actual content on short windows.
Support retains its original two-column ratio, and the footer retains its logo,
links and compact spacing. No CSS zoom or transform is applied to the sections.

These sections use Technology's desktop query (1100px+, or a landscape fine
pointer window of at least 600px and 4:3). Mobile and touch-tablet layouts remain
independent. Product/Support anchor offsets follow that same query, and resizing
back to mobile clears the measured card height. Product links, direct fragments
and Why-us Skip use one landing offset: the visible gap above its heading equals
the heading-to-card gap (20 reference pixels). Support keeps its navbar-aligned edge. Browser checks cover 1280×584,
1422×649 (90% zoom equivalent), 1536×730, 1920×876, 1097×500, 960×438,
1280×450 and 390×844. `npm run test:product` checks scaled height budgets,
content expansion and the desktop-to-mobile reset in addition to catalogue and
carousel behavior.

### Product catalogue / deferred imagery

Product cards use the September 2026 Architect Catalogue Copy Brief: Novi
₹19,999, Vero ₹29,999, Aera ₹34,999, Sora ₹49,999 and Liva ₹59,999.
Luma is omitted until its catalogue content is supplied; its assets are retained.
The current photo assignments are intentionally preserved for this layout pass.
`product-aera-new.jpg` duplicates Sora's photo. Liva's current photo depicts a
floor-standing body although the catalogue specifies the wall-hung N50 model.
Correcting these two photos is deferred, not a change to their specifications.

### Footer

The original footer layout, logo, typography and links are retained. The tagline
is “Rethink the everyday”. Footer clouds, their parallax and Back to top are
removed. Desktop spacing is slightly tighter and scales with the shared layout unit.
The experimental video and animation code have been removed.
The mobile refinement leaves the original footer spacing and stacked link groups
intact, without adding entrance animations or a new section divider.

### Section navigation

Desktop links use distance-based timing (up to 1.5 seconds) and quintic easing
with continuous velocity and acceleration at departure and arrival. When crossing the held Why-us scene, navigation omits
its inactive reading runway from the animated distance. The actual layout and
manual wheel behaviour are unchanged. Clicks, wheel input and resize can
interrupt the journey; section/header offsets are preserved. The existing
native and reduced-motion fallbacks remain. Run npm run test:scroll for the
navigation timing, route mapping and interruption checks.

Upward trips to Technology or Home prepare the offscreen Why-us introduction
before crossing its pinned scene, preventing a late white-to-black card swap.


### Collection, form and reversible section motion

The mobile presentation remains the inverse of the desktop/fine-pointer landscape
query. Desktop and the hero-to-Technology transition retain their existing design.

`js/mobile-card-deck.js` animates the original five complete product articles:
photo, name, price and features move together within one rounded outline. Media
nodes remain inside their articles at every breakpoint. Photos are square, use
20px phone gutters, and cap at 448px. Adjacent cards show 16px at 94% scale;
there is no viewport-height image budget. Short screens use normal page flow.
The same source images and catalogue information are retained.

Pointer gestures start on the photo or card text; disclosure buttons keep native
click and focus behavior. An 8px dead zone and 1.3x horizontal
axis test preserve vertical scrolling; CSS allows pan-y and pinch-zoom. An 18%
width drag or a same-direction flick (at least 12px and .45px/ms) advances one
product. Settling takes 320ms and rapid input retargets the rendered poses without
queuing transitions. Each pointer update paints at most once per animation frame;
there are no layout reads in the drag or settling frame. Cancellation, lost capture,
multi-touch, resize, reduced motion and hidden/offscreen pages restore settled poses.
Failed photos retain the square frame and show a named fallback.

`carousel.changeProduct(direction, source)` is the shared internal selection
operation for arrows, keyboard and drag. `onProductChange` receives
`{previousIndex, index, direction, source}`; model, price, counter and live
announcement stay synchronized. This is not a public API. The original 44px
arrows and 01 / 05 counter remain below the complete card stack.

`js/mobile-product.js` owns the shared disclosure state and reading assistance.
All 13 feature rows use page flow. Product headings reserve the tallest measured
content at the current width and font size, measured independently of card scale.
There is no separate text fade or stationary information panel. Expanded button/keyboard
changes bring the card below the header; card dragging never initiates page
scrolling. Bottom collapse restores focus. All five products and features remain
readable without JavaScript.

Contact fields have zero row gaps, 1.25rem vertical padding and 1rem/1.5 text.
The message textarea starts at three lines (4.5rem), shares the same first-line
alignment, and grows with input. Validation messages are in normal flow. Focus
underlines take 180ms; typed text stays still. The tablet's paired fields and the
desktop layout are preserved.

`js/site-motion.js` replaces both one-shot reveal observers with a shared,
position-driven scene controller. It uses `main.js`'s existing scroll frame,
reads stationary offset anchors before writes, and caches geometry until fonts,
resizing or content changes require remeasurement. Returning to a scroll position
reproduces the same pose; no elapsed-time smoothing chases scroll values.
Ordinary entrances begin at 88% of viewport height and settle by 62%, then remain
still through the reading area. A shallow 8px departure occurs only near the header.
Footer endpoints are clamped to the document end so even the copyright fully settles.
Offscreen scenes write their clamped endpoint once; hidden documents suspend work.

Collection and Contact headings use static phrase windows. Technology's title
remains owned solely by the existing cloud handoff. Form underlines draw with their
field rows; paired desktop/tablet fields share an anchor. Focused, edited and invalid
fields stay settled. Mobile menu labels keep their reversible timed open/close motion.
The restored footer layout is unchanged; its logo, tagline, links and rule have
shallow reversible entrances. Reduced-motion and flow fallbacks remain readable.

The carousel renderer composes entry progress with its existing card positions:
the centre rises 24px at .98–1 scale, then the neighbors spread. Interaction captures
the current visible pose and owns the cards until the collection leaves view.
Mobile drag settlement stays 320ms; desktop selection uses a retargetable 420ms
deceleration. No second controller writes the carousel's positioning transform.

All seven Technology panels open over 220ms, with descriptions visible immediately
while lifting over 320ms. Mobile photos are fetched and decoded one viewport ahead
of Technology, including unopened cards, so a tap uses the already-prepared source.
Photos start visibly at 55% opacity and complete a short fade in about 160ms while
settling from 1.035 scale over 560ms. Copy starts at 70% opacity with no delay and
finishes its fade over 160ms. Reopening never clears a prepared image or waits for
a fresh decode before starting these animations. Data-saving connections prepare only
the open/requested photo, and hidden tabs do not start background preparation.
Image failures and interrupted disclosure heights retain existing readable fallbacks.
Run `npm run test:technology-images` for preparation, instant cached selection,
responsive sources, failed decodes and rapid-selection coverage.
The expanded mobile title and description have no intervening decorative divider.

Technology's final rule still meets the solid black Why-us boundary directly.
The six Why-us cards retain their existing scroll distance and mobile reading holds.
Incoming headings use overlapping word-by-word waves. Whole-word spans preserve
punctuation, emphasis, original wrapping and an unfragmented accessible heading name.
Incoming words start around .4 progress and finish by .9; copy/pills finish by .98.
The introduction resolves its three words and two reassurance phrases in order.
Service pills move inward; patents settle upward from .96 scale; the first "100%"
word settles from 1.04 scale. Non-warranty scenes depart only after 60% coverage.
The mobile warranty statistics and central divider keep their exact original
cubic-out .64–.98 and .73–1 curves, without additional departure motion. Desktop
receives the same comparison treatment. Desktop panel travel stays proportional to
scroll position, with no per-segment easing or speed boost; the original opening
and closing allowances remain. Both modes preserve total scroll distance and retrace on
reverse input. Short screens, oversized content and reduced motion use ordinary flow.

Shared mobile headings remain Helvetica Neue, 2rem/1.15 with -.02em tracking
(2.5rem on portrait/touch tablets). Section spacing remains 3.5rem, subtitle spacing
.75rem and introduction-to-content spacing 2rem. No decorative media or animation
library was added. Rebuild the committed stylesheet with `npm run css` after edits.

References: [Impronta](https://www.e-t.studio/works/impronta-website),
[Caeli Énergie](https://www.awwwards.com/sites/caeli-energie),
[MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action),
and [web.dev animation performance](https://web.dev/articles/animations-guide).

Validation for the second pass, 2026-10-03:

- Whole-card follow-up: all eight checks pass. Photo/text and expanded-feature
  swipes were exercised in Chromium; disclosures still receive native clicks.
  The unified outline has no photo-to-body gap. Square geometry, equal heading
  heights and no horizontal overflow were verified at the six sizes below,
  with 200% text, reduced motion and no-JavaScript fixtures checked again.
  Desktop measurements still match at all three recorded sizes. The expanded
  Technology title-to-description divider is removed.

- The seven existing checks and the new `test:card-deck` cover navigation,
  Why-us reversal/holds, catalogue integrity, disclosures, gestures, rapid input,
  cancellation, breakpoint restoration, image errors, hidden-page cleanup and
  reduced motion. Gesture tests assert that animation frames make no layout reads.
- Chromium layout checks cover 320x640, 360x800, 390x844, 430x932, 768x1024 and
  390x480. All checked photo frames are square, headings match, and the page has no
  horizontal overflow. Standard fields have equal 20px padding and 24px line height;
  message starts at 72px. Validation messages remain inside their fields.
- Local response fixtures exercise blocked scripts, 200% root text, missing images
  and reduced motion. These fixtures are not deployed. Enlarged Why-us content uses
  ordinary flow; all five products remain visible without scripts.
- Desktop widths, heights and heading fonts match the preceding recorded layout
  at 1280x585, 1440x900 and the 1024x600 fine-pointer landscape breakpoint.
  Original photos remain inside the desktop cards after rotation/breakpoint changes.
- A local pointer-drag timing sample recorded 211 animation-frame intervals:
  median 6.9ms, 95th percentile 7.3ms, maximum 62.5ms, and no reported long tasks.
  This is one unthrottled desktop Chromium sample with browser-inspection overhead,
  not a physical-phone performance guarantee.
- Physical iOS/Android devices, coarse-pointer landscape emulation and CPU-throttled
  traces are unavailable in this session and remain unverified.

Validation for reversible desktop/mobile motion, 2026-10-03:

- All nine existing checks plus `npm run test:motion` pass. New regressions cover
  exact forward/reverse poses, reading intervals, upper-edge returns, bottom-of-page
  settlement, all six word sequences, proportional desktop travel, the unchanged mobile
  warranty curves, and carousel takeover from a partially assembled pose.
- Chromium baseline comparisons against bd0de4a match section heights, heading
  dimensions/type settings, field dimensions and photo geometry at 320x640,
  360x800, 390x844, 430x932, 768x1024, 390x480, 844x390, 1024x600,
  1280x585 and 1440x900. No horizontal overflow was measured.
- Browser interaction checks exercise all seven Technology selections and all five
  products in both presentations, mobile expanded-card swiping, menu open/close,
  word/card reversal, edited form stability, footer settlement and section links.
  Resizing desktop -> phone -> tablet -> landscape -> desktop preserves selection.
  Reloading a page without a fragment restores its exact scroll pose; a section
  bookmark retains the site's existing explicit anchor landing behavior.
- Temporary response fixtures verify 200% root text, reduced motion, image failures,
  and script-free content. Enlarged Why-us content switches to ordinary flow.
  The no-script header now uses a solid dark surface, and the desktop catalogue
  exposes all five articles in page flow instead of an unusable static stack.
  These fallback rules apply only without scripts; enhanced resting layouts match.
- Unthrottled animation-frame samples during repeated scrolling and reversals:
  mobile viewport, 376 intervals, median 7.0ms, p95 7.2ms, maximum 7.8ms;
  desktop viewport, 461 intervals, median 7.0ms, p95 7.3ms, maximum 20.8ms.
  Neither sample reported a long task or an interval above 34ms. Browser-control
  overhead is included; these are observations, not device performance guarantees.
- Entrance, reading and departure captures were saved for desktop and mobile,
  together with all six Why-us reading scenes, collection, contact and footer views.
  No application JavaScript errors were reported in the final normal-page check.
- Physical iOS/Android, Safari/Firefox, coarse-pointer landscape emulation,
  real mobile toolbar behavior and CPU-throttled/GPU traces were unavailable.
  Hidden-tab recovery, cancelled gestures and toolbar-resize invariants are covered
  by deterministic controller tests, rather than physical-device verification.

Scroll-control correction, 2026-10-03:

- Removed the desktop Why-us segment hold/smoothstep remapping. It could make the
  panels travel up to 1.76 times the previous rate midway through each segment.
  Only the text/detail animation is eased; the desktop track uses its original
  proportional travel. Native mobile covers and warranty timing are unchanged.
- Fixed real cancellation in the shared scroll controller. Lenis 1.3.26 returns
  early from `scrollTo(actualScroll, {immediate:true})` when target and actual
  already match, including after `resize()` and during programmatic navigation.
  The old cancellation could release its callback while the animation continued
  through the section-skip route. Stop/start now halts that animation before
  releasing navigation state. Touch, keyboard, scrollbar, resize, wheel interruption
  and same-position retargeting use the corrected path.
- Preserved the existing .085 wheel damping, .82 multiplier and large-impulse
  attenuation. Routed deltas now use that same damping rather than a separate
  faster response. There is no section-dependent input multiplier. Mobile wheel
  and touch remain native, and mobile anchor animation yields on touchstart.
- `npm run test:scroll-input` runs the actual vendored engine, not a scrollTo mock.
  Its cancellation regression failed on the previous code (917.6px -> 11000px
  after cancellation) and passes after the fix. It also checks equal wheel distances,
  immediate reversal, native mobile input and cancellation by each input type.
- Chromium reproduction: before, cancellation at 916.7px continued to 7154px;
  after, cancellation at 922.7px stayed at 922.7px. Equal 120px wheel events at
  three Why-us positions each moved 96.7px; a 430px trackpad-style burst moved
  352.7px. Document height remained stable. Physical touch-device testing remains
  unavailable; native touch/fallback interruption is covered by controller tests.
