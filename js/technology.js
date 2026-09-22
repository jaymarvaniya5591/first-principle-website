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
  var details = cards.map(function (card) { return card.querySelector('.feature__detail'); });
  var mobilePhotos = cards.map(function (card) { return card.querySelector('.feature__mobile-photo'); });
  var desktopActive = 0, mobileActive = 0, mobileRequest = 0, mobileNear = false;
  var animations = [], anchorTimer = 0, savedAnchor = null;
  var mobileViewFrame = 0, mobileLayout = null;
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
    desktopActive = index;
    if (desktop.matches && reveal && index >= 0) section.classList.add('features--explored');
    cards.forEach(function (card, i) {
      var open = i === index;
      card.classList.toggle('is-active', open);
      buttons[i].setAttribute('aria-expanded', String(open));
      details[i].hidden = false;
      details[i].inert = !open;
      details[i].setAttribute('aria-hidden', String(!open));
      card.querySelector('.feature__desc').setAttribute('aria-hidden', String(!open));
    });
    if (index >= 0) showImage(index);
    targetScroll = list.scrollTop;
    transitionUntil = performance.now() + (reduced.matches ? 0 : 210);
    revealUntil = reveal && index >= 0 ? transitionUntil + 140 : 0;
    schedule();
  }

  function mobileState(index, open) {
    cards[index].classList.toggle('is-active', open);
    buttons[index].setAttribute('aria-expanded', String(open));
    details[index].setAttribute('aria-hidden', String(!open));
    details[index].inert = !open;
    cards[index].querySelector('.feature__desc').setAttribute('aria-hidden', String(!open));
  }

  function finishDetail(index) {
    if (animations[index]) animations[index].cancel();
    animations[index] = null;
    cards[index].style.removeProperty('height');
    details[index].hidden = index !== mobileActive;
  }

  function animateDetail(index, from) {
    var card = cards[index];
    if (animations[index]) animations[index].cancel();
    card.style.removeProperty('height');
    var to = card.getBoundingClientRect().height;
    if (reduced.matches || Math.abs(from - to) < 1) { finishDetail(index); return; }
    var animation = card.animate([{ height: from + 'px' }, { height: to + 'px' }], {
      duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)'
    });
    animations[index] = animation;
    animation.onfinish = function () {
      if (animations[index] === animation) finishDetail(index);
    };
  }

  function mobileBounds() {
    var viewport = window.visualViewport;
    return {
      top: Math.max(header.getBoundingClientRect().bottom, viewport ? viewport.offsetTop : 0) + 12,
      bottom: (viewport ? viewport.offsetTop + viewport.height : innerHeight) - 12
    };
  }

  function sizeMobilePhoto(index) {
    var photo = mobilePhotos[index];
    if (photo.hidden) return;
    var card = cards[index], description = card.querySelector('.feature__desc');
    var next = card.querySelector('.feature__next'), bounds = mobileBounds();
    var textHeight = buttons[index].getBoundingClientRect().height + description.getBoundingClientRect().height
      + parseFloat(getComputedStyle(description).marginBottom) + (next ? next.getBoundingClientRect().height : 0) + 1;
    var natural = card.clientWidth * .75;
    // Text and targets never shrink. Compact images keep their full subject visible.
    var height = Math.min(natural, Math.max(144, bounds.bottom - bounds.top - textHeight));
    photo.style.height = height + 'px';
    photo.classList.toggle('is-compact', height < natural - 1);
  }

  function cancelMobileView() {
    cancelAnimationFrame(mobileViewFrame);
    mobileViewFrame = 0;
  }

  function moveMobileView(target) {
    cancelMobileView();
    var start = scrollY, distance = target - start;
    if (Math.abs(distance) < 1) return;
    if (reduced.matches) { window.scrollTo({ top: target, behavior: 'instant' }); return; }
    var began = performance.now();
    function step(time) {
      var progress = Math.min(1, (time - began) / 180);
      window.scrollTo({ top: start + distance * (1 - Math.pow(1 - progress, 3)), behavior: 'instant' });
      mobileViewFrame = progress < 1 ? requestAnimationFrame(step) : 0;
    }
    mobileViewFrame = requestAnimationFrame(step);
  }

  function mobileDestination(index, sequential) {
    var rect = cards[index].getBoundingClientRect(), bounds = mobileBounds();
    if (rect.height <= bounds.bottom - bounds.top + 1) {
      var top = sequential ? bounds.top : Math.max(bounds.top, Math.min(rect.top, bounds.bottom - rect.height));
      return scrollY + rect.top - top;
    }
    // Very short landscape views or enlarged text prioritize the title and
    // description; the photo remains immediately above in native page flow.
    return scrollY + buttons[index].getBoundingClientRect().top - bounds.top;
  }

  function loadMobileImage(index) {
    var request = ++mobileRequest;
    var photo = mobilePhotos[index];
    var pic = photo.querySelector('picture');
    if (!pic) {
      photo.appendChild(photo.querySelector('template').content.cloneNode(true));
      pic = photo.querySelector('picture');
    }
    prepare(pic).then(function (ready) {
      if (desktop.matches || request !== mobileRequest || mobileActive !== index) return;
      var rect = cards[index].getBoundingClientRect(), bounds = mobileBounds();
      var visible = rect.top < bounds.bottom && rect.bottom > bounds.top;
      photo.hidden = !ready;
      photo.classList.toggle('is-ready', ready);
      // Failed media must not leave a tall empty frame or a fixed animation height.
      if (!ready) {
        finishDetail(index);
        if (visible) moveMobileView(mobileDestination(index, false));
      }
    });
  }

  function releaseAnchor() {
    clearTimeout(anchorTimer);
    if (savedAnchor !== null) document.documentElement.style.overflowAnchor = savedAnchor;
    savedAnchor = null;
  }

  function selectMobile(index, sequential) {
    var target = index >= 0 ? index : mobileActive;
    if (target < 0) return;
    cancelMobileView();
    var before = (index >= 0 ? cards[target] : buttons[target]).getBoundingClientRect().top;
    var from = cards[target].getBoundingClientRect().height;
    // Suppress browser anchoring during this explicit layout change; compensate
    // for earlier rows closing before assisting the selected card into view.
    if (savedAnchor === null) savedAnchor = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = 'none';
    clearTimeout(anchorTimer);
    mobileActive = index;
    ++mobileRequest;
    cards.forEach(function (card, i) {
      mobileState(i, i === index);
      finishDetail(i);
    });
    if (index >= 0) sizeMobilePhoto(index);
    // Compensate for an earlier row closing before deciding whether the new
    // complete card needs to move. Never force an already visible card to the top.
    var rect = cards[target].getBoundingClientRect();
    var shift = rect.top - before;
    if (Math.abs(shift) > .5) window.scrollBy({ top: shift, behavior: 'instant' });
    var destination = index >= 0 ? mobileDestination(index, sequential) : scrollY;
    animateDetail(target, from);
    moveMobileView(destination);
    if (sequential) buttons[target].focus({ preventScroll: true });
    if (index >= 0) loadMobileImage(index);
    anchorTimer = setTimeout(releaseAnchor, reduced.matches ? 0 : 220);
  }

  function markScrolling() {
    section.classList.add('features--explored');
  }

  function measure() {
    measureFrame = 0;
    if (!desktop.matches) {
      var width = list.clientWidth, headingHeight = heading.getBoundingClientRect().height;
      // Browser toolbar height changes must not resize the image mid-swipe.
      if (!mobileLayout || mobileLayout.width !== width || mobileLayout.heading !== headingHeight) {
        cancelMobileView();
        details.forEach(function (_, i) { finishDetail(i); });
        if (mobileActive >= 0) sizeMobilePhoto(mobileActive);
        mobileLayout = { width: width, heading: headingHeight };
      }
      return;
    }
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
    section.classList.toggle('features--mobile', !desktop.matches);
    ++mobileRequest;
    cancelMobileView();
    mobileLayout = null;
    releaseAnchor();
    details.forEach(function (_, i) { finishDetail(i); });
    cancelAnimationFrame(frame); frame = 0; lastTime = 0;
    pointerX = pointerY = null;
    targetScroll = 0; list.scrollTop = 0; route = '';
    // Force ARIA and classes into sync, including on the first run.
    active = -2;
    if (desktop.matches) {
      body.insertBefore(media, body.firstChild);
      setActive(desktopActive, false);
      measure();
    } else {
      flow = false;
      layout = null;
      section.classList.remove('features--flow');
      list.removeAttribute('tabindex');
      list.removeAttribute('aria-describedby');
      cards.forEach(function (_, i) { mobileState(i, i === mobileActive); });
      if (mobileActive >= 0 && mobileNear) loadMobileImage(mobileActive);
      measure();
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
      if (!desktop.matches) return;
      setActive(i, true);
    });
    buttons[i].addEventListener('click', function () {
      if (!desktop.matches) selectMobile(mobileActive === i ? -1 : i, false);
    });
    var next = card.querySelector('[data-next-feature]');
    if (next) next.addEventListener('click', function () {
      if (!desktop.matches) selectMobile(Number(next.dataset.nextFeature), true);
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
  reduced.addEventListener('change', function () {
    if (!desktop.matches && reduced.matches) {
      cancelMobileView();
      details.forEach(function (_, i) { finishDetail(i); });
    }
    requestMeasure(); schedule();
  });
  ['touchstart', 'wheel', 'pointerdown', 'keydown'].forEach(function (name) {
    window.addEventListener(name, cancelMobileView, { passive: true });
  });
  window.addEventListener('resize', requestMeasure, { passive: true });
  new ResizeObserver(requestMeasure).observe(heading);
  new ResizeObserver(requestMeasure).observe(header);
  reconcile();
  document.fonts.ready.then(requestMeasure);

  var nearby = new IntersectionObserver(function (entries) {
    if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
    mobileNear = true;
    if (desktop.matches) {
      prepare(pictures[imageIndex]);
      if (!(navigator.connection && navigator.connection.saveData)) pictures.forEach(prepare);
    } else {
      if (mobileActive >= 0) loadMobileImage(mobileActive);
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
