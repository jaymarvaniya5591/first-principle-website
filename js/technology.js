/* Technology: bounded desktop explorer, independent of the mobile accordion. */
(function () {
  'use strict';
  var section = document.getElementById('technology');
  if (!section) return;
  var body = section.querySelector('.features__body');
  var media = document.getElementById('features-media');
  var list = section.querySelector('.features__list');
  var heading = section.querySelector('.section-head');
  var header = document.querySelector('.topbar');
  var cards = Array.from(list.querySelectorAll('.feature'));
  var pictures = Array.from(media.querySelectorAll('picture'));
  var buttons = cards.map(function (card) { return card.querySelector('button'); });
  // Match the CSS explorer query. A scaled laptop can expose fewer than 1100
  // CSS pixels without becoming a touch/mobile layout. Use available geometry
  // and input capability, never OS scaling, browser zoom or device pixel ratio.
  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  var finePointer = matchMedia('(hover:hover) and (pointer:fine)');
  var active = -1, imageIndex = 0, requestedImage = -1;
  var imageRequest = 0, flow = false, panelHeight = 720, headerHeight = 0;
  var targetScroll = 0, frame = 0, lastTime = 0, revealUntil = 0, transitionUntil = 0;
  var pointerX = null, pointerY = null, measureFrame = 0, route = '';
  var layout = null;
  var prepared = new WeakMap();
  section.classList.add('features--enhanced');

  function prepare(pic) {
    var img = pic.querySelector('img');
    img.loading = 'eager';
    // A responsive source can change after a resize. Cache only that decoded source.
    var source = img.currentSrc || img.src;
    var cached = prepared.get(img);
    if (cached && cached.source === source) return cached.promise;
    var promise = img.decode().then(function () { return true; }, function () { return false; });
    prepared.set(img, { source: source, promise: promise });
    return promise;
  }

  function showImage(index) {
    if (index < 0 || index === requestedImage) return;
    requestedImage = index;
    var request = ++imageRequest;
    prepare(pictures[index]).then(function (ready) {
      if (request !== imageRequest) return;
      if (!ready) { requestedImage = -1; return; }
      imageIndex = index;
      pictures.forEach(function (pic, i) {
        pic.classList.toggle('is-active', i === index);
        pic.setAttribute('aria-hidden', String(i !== index));
      });
    });
  }

  function maxScroll() { return Math.max(0, list.scrollHeight - list.clientHeight); }
  function clamp(value, max) { return Math.max(0, Math.min(value, max)); }
  function schedule() { if (!frame) frame = requestAnimationFrame(tick); }

  function tick(time) {
    frame = 0;
    if (!desktop.matches || flow) return;
    var dt = lastTime ? Math.min(40, time - lastTime) : 16;
    lastTime = time;
    var max = maxScroll();
    targetScroll = clamp(targetScroll, max);
    // Measure only during a card transition, not on every page-scroll frame.
    if (active >= 0 && time <= revealUntil) {
      var card = cards[active];
      var cardRect = card.getBoundingClientRect();
      var listRect = list.getBoundingClientRect();
      var top = cardRect.top - listRect.top + list.scrollTop;
      var bottom = top + cardRect.height;
      if (bottom > targetScroll + listRect.height) targetScroll = Math.ceil(bottom - listRect.height);
      if (top < targetScroll) targetScroll = Math.floor(top);
      targetScroll = clamp(targetScroll, max);
    }
    var remaining = targetScroll - list.scrollTop;
    var step = remaining * (1 - Math.exp(-dt / 38));
    // Chrome may quantize scrollTop to device pixels. Always make progress at
    // the end of a high-refresh-rate glide instead of scheduling idle frames.
    if (Math.abs(step) < 1) step = Math.sign(remaining) * Math.min(1, Math.abs(remaining));
    list.scrollTop = reduced.matches || Math.abs(remaining) <= 1
      ? targetScroll : list.scrollTop + step;
    if (time < transitionUntil || time < revealUntil || Math.abs(targetScroll - list.scrollTop) > .5) schedule();
    else lastTime = 0;
  }

  function setActive(index, reveal) {
    if (index === active) { if (index >= 0) showImage(index); return; }
    active = index;
    if (desktop.matches && reveal && index >= 0) section.classList.add('features--explored');
    cards.forEach(function (card, i) {
      var open = i === index;
      card.classList.toggle('is-active', open);
      buttons[i].setAttribute('aria-expanded', String(open));
      card.querySelector('.feature__desc').setAttribute('aria-hidden', String(!open));
    });
    if (index >= 0) showImage(index);
    if (!desktop.matches) {
      if (index >= 0) cards[index].insertBefore(media, cards[index].firstChild);
      return;
    }
    targetScroll = list.scrollTop;
    transitionUntil = performance.now() + (reduced.matches ? 0 : 210);
    revealUntil = reveal && index >= 0 ? transitionUntil + 140 : 0;
    schedule();
  }

  function markScrolling() {
    section.classList.add('features--explored');
  }

  function measure() {
    measureFrame = 0;
    if (!desktop.matches) return;
    var width = section.clientWidth;
    var resized = layout && (layout.width !== width || layout.height !== innerHeight);
    var wasAligned = layout && Math.abs(scrollY - layout.anchor) <= 2;
    // One unit scales the approved 1280px-wide composition, just as the hero's
    // scene unit does. Measure the content width, excluding the page scrollbar.
    var unit = width / 1280;
    section.style.setProperty('--technology-unit', unit + 'px');
    headerHeight = header.getBoundingClientRect().height;
    section.style.setProperty('--technology-header', headerHeight + 'px');
    var gap = parseFloat(getComputedStyle(section).paddingTop);
    var available = innerHeight - headerHeight - gap * 2 - heading.getBoundingClientRect().height;
    // The readable fallback threshold scales with the content, rather than
    // switching typography at an arbitrary window height or zoom percentage.
    var minimumPanel = 340 * unit;
    flow = available < minimumPanel;
    panelHeight = Math.max(minimumPanel, available);
    section.classList.toggle('features--flow', flow);
    section.style.setProperty('--technology-panel', panelHeight + 'px');
    list.tabIndex = flow ? -1 : 0;
    if (flow) list.removeAttribute('aria-describedby');
    else list.setAttribute('aria-describedby', 'features-hint');
    targetScroll = clamp(list.scrollTop, maxScroll());
    if (active >= 0) { revealUntil = performance.now() + 220; schedule(); }
    var anchor = section.getBoundingClientRect().top + scrollY - headerHeight;
    // Zoom/resize also changes the hero's height above us. If the user was
    // already at Technology's entrance, keep that entrance below the header.
    // Never pull someone back after they have scrolled on to another section.
    if (resized && wasAligned) {
      if (window.siteScroll) window.siteScroll.cancel();
      window.scrollTo({ top: anchor, behavior: 'instant' });
      if (window.siteScroll) window.siteScroll.cancel();
    }
    layout = { width: width, height: innerHeight, anchor: anchor };
  }

  function requestMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }

  function reconcile() {
    section.classList.remove('features--ready');
    section.classList.toggle('features--desktop', desktop.matches);
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    pointerX = pointerY = null;
    targetScroll = 0; list.scrollTop = 0; route = '';
    var selected = active >= 0 ? active : imageIndex;
    // Force ARIA and classes into sync, including on the first run.
    active = -2;
    if (desktop.matches) {
      body.insertBefore(media, body.firstChild);
      setActive(selected, false);
      measure();
    } else {
      flow = false;
      layout = null;
      section.classList.remove('features--flow');
      list.removeAttribute('tabindex');
      list.removeAttribute('aria-describedby');
      setActive(selected, false);
    }
    // Establish the initial/breakpoint layout without an entrance resize.
    list.getBoundingClientRect();
    section.classList.add('features--ready');
  }

  list.addEventListener('pointermove', function (event) {
    if (!desktop.matches || !finePointer.matches || event.pointerType === 'touch') return;
    // Pointerover/enter also fire when rows animate under a stationary mouse.
    // Only actual movement is allowed to select a different row.
    if (event.clientX === pointerX && event.clientY === pointerY) return;
    pointerX = event.clientX; pointerY = event.clientY;
    var card = event.target.closest('.feature');
    if (!card) return;
    var index = cards.indexOf(card);
    if (index !== active) setActive(index, true);
  });
  list.addEventListener('pointerleave', function () {
    pointerX = pointerY = null;
  });
  list.addEventListener('pointerdown', function (event) {
    if (!desktop.matches) return;
    if (event.target === list) {
      revealUntil = 0; markScrolling();
    }
  });
  list.addEventListener('focusin', function (event) {
    if (!desktop.matches || !event.target.matches('.feature__btn:focus-visible')) return;
    setActive(buttons.indexOf(event.target), true);
  });
  cards.forEach(function (card, i) {
    card.addEventListener('click', function () {
      if (!desktop.matches) { setActive(active === i ? -1 : i, false); return; }
      setActive(i, true);
    });
  });
  section.addEventListener('keydown', function (event) {
    if (!desktop.matches) return;
    if (flow || !list.contains(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
    var current = buttons.indexOf(event.target);
    var next = event.key === 'ArrowDown' ? current + 1 : event.key === 'ArrowUp' ? current - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : null;
    if (next !== null) {
      event.preventDefault();
      buttons[clamp(next, cards.length - 1)].focus({ preventScroll: true });
    } else if (event.key === 'PageDown' || event.key === 'PageUp') {
      event.preventDefault();
      revealUntil = 0; markScrolling();
      targetScroll = clamp(list.scrollTop + (event.key === 'PageDown' ? 1 : -1) * list.clientHeight, maxScroll());
      schedule();
    }
  });
  list.addEventListener('scroll', function () {
    if (!desktop.matches || flow) return;
    // Native scrollbar/touch movement can interrupt our pending reveal.
    if (!frame) { targetScroll = list.scrollTop; markScrolling(); }
  }, { passive: true });

  body.addEventListener('wheel', function (event) {
    if (!desktop.matches || flow || event.ctrlKey || event.metaKey || !event.cancelable
      || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    // The whole photo uses ordinary page scrolling, right up to the divider.
    if (!list.contains(event.target)) { route = ''; return; }
    var mediaBounds = media.getBoundingClientRect();
    event.preventDefault();
    // Lenis sees defaultPrevented and leaves this event to this coordinator.
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? list.clientHeight : 1);
    // A nested scroller must never catch the cursor while the panel is still
    // entering (or leaving) the viewport. Forward explicitly, rather than
    // returning and allowing native scrolling to catch the list without Lenis.
    var fullyVisible = mediaBounds.top >= headerHeight - 1 && mediaBounds.bottom <= innerHeight + 1;
    if (!fullyVisible) {
      route = 'page';
      revealUntil = 0;
      targetScroll = list.scrollTop;
      if (window.siteScroll) window.siteScroll.by(delta);
      else window.scrollBy({ top: delta, behavior: 'instant' });
      return;
    }
    if (route !== 'cards' && window.siteScroll) window.siteScroll.cancel();
    route = 'cards';
    markScrolling();
    // Scrolling moves the list; only an intentional selection replaces the
    // open card and its image. Cancel reveal motion so it cannot fight input.
    revealUntil = 0;
    var ahead = targetScroll - list.scrollTop;
    if (Math.abs(ahead) > 1 && Math.sign(ahead) !== Math.sign(delta)) targetScroll = list.scrollTop;
    var before = clamp(targetScroll, maxScroll());
    targetScroll = clamp(before + delta, maxScroll());
    var consumed = targetScroll - before;
    var remainder = delta - consumed;
    if (Math.abs(remainder) > .01) {
      if (window.siteScroll) window.siteScroll.by(remainder);
      else window.scrollBy({ top: remainder, behavior: 'instant' });
    } else if (window.siteScroll) window.siteScroll.cancel();
    schedule();
  }, { passive: false });
  body.addEventListener('pointerleave', function () { route = ''; });

  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', function () { requestMeasure(); schedule(); });
  window.addEventListener('resize', requestMeasure, { passive: true });
  new ResizeObserver(requestMeasure).observe(heading);
  new ResizeObserver(requestMeasure).observe(header);
  reconcile();
  showImage(0);
  document.fonts.ready.then(requestMeasure);

  var nearby = new IntersectionObserver(function (entries) {
    if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
    prepare(pictures[imageIndex]);
    if (desktop.matches && !(navigator.connection && navigator.connection.saveData)) {
      pictures.forEach(prepare);
    }
    nearby.disconnect();
  }, { rootMargin: '100% 0px' });
  nearby.observe(section);

  // Match nav-click clearance after fonts and the browser's initial fragment jump.
  if (location.hash === '#technology') {
    var interrupted = false;
    var interrupt = function () { interrupted = true; };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (name) {
      window.addEventListener(name, interrupt, { once: true, passive: true });
    });
    var loaded = document.readyState === 'complete' ? Promise.resolve()
      : new Promise(function (resolve) { window.addEventListener('load', resolve, { once: true }); });
    Promise.all([loaded, document.fonts.ready]).then(function () {
      ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (name) { window.removeEventListener(name, interrupt); });
      if (!desktop.matches || interrupted) return;
      measure();
      requestAnimationFrame(function () {
        window.scrollTo({ top: section.getBoundingClientRect().top + scrollY - header.getBoundingClientRect().height, behavior: 'instant' });
      });
    });
  }
})();
