# First Principle — Landing Page

Static landing page for First Principle smart toilets, built 1:1 from the Figma design
(`FIRST PRINCIPLE — LANDIN PAGE`, Web 1440px + Mobile 390px frames).

## Stack

- Plain HTML / CSS / vanilla JS — no build step.
- Self-hosted fonts in `assets/fonts` (Anton, Billion Dreams, Helvetica Now Display, Helvetica Neue). Manrope is loaded from Google Fonts.
- Images exported from Figma + feature renders in `assets/img`.

## Structure

```
index.html        # all sections (hero, features, why, collection, contact, footer)
css/styles.css    # tokens, desktop layout, mobile breakpoint (<= 767px)
js/main.js        # feature accordion, product carousel, mobile menu, contact form
assets/           # fonts + images
vercel.json       # clean URLs + long cache for assets
```

## Local preview

Serve the folder with any static server, e.g. `npx serve .` or `python -m http.server`.

## Deploy

Deployed on Vercel as a static site (no framework, no build command).
