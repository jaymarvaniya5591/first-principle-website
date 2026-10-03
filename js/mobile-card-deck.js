/* Animate complete product articles on mobile. Images and details keep their
   original ownership; catalogue selection remains owned by main.js. */
(function () {
  'use strict';
  var carousel = document.querySelector('.carousel');
  if (!carousel) return;
  var section = document.getElementById('product');
  var cards = Array.from(carousel.querySelectorAll('.card'));
  var media = cards.map(function (card) { return card.querySelector('.card__media'); });
  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  var deck = carousel.querySelector('.carousel__stage');
  deck.classList.add('product-deck');
  deck.tabIndex = 0;
  var width = 0, poses = [], rendered = [], frame = 0, measureFrame = 0, gesture = null, mounted = false, nearby = true;
  var sceneEntry = 1, sceneExit = 0, sceneLocked = false;
  var active = function () { return Number(carousel.dataset.active) || 0; };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var copy = function (p) { return {x:p.x, y:p.y || 0, scale:p.scale, opacity:p.opacity, z:p.z}; };
  function sceneValues() {
    var entry = sceneLocked || reduced.matches ? 1 : sceneEntry;
    var exit = sceneLocked || reduced.matches ? 0 : sceneExit;
    var center = ease(clamp(entry / (desktop.matches ? .85 : .75), 0, 1));
    var spreadProgress = clamp((entry - (desktop.matches ? .08 : .18)) / (desktop.matches ? .92 : .72), 0, 1);
    // On laptops, let the neighbours unfold while the card is actually coming
    // into view. A cubic-out spread spent most of its motion near the bottom edge.
    // This is a direct scroll pose, not extra inertia or a timed animation queue.
    var spread = desktop.matches ? spreadProgress * spreadProgress * (3 - 2 * spreadProgress) : ease(spreadProgress);
    // Fade the edges in after the centre gains opacity, keeping product labels
    // from showing through one another during the longer desktop assembly.
    var edges = desktop.matches ? clamp((entry - .32) / .53, 0, 1) : 1;
    var neighborAlpha = center * spread * edges * edges * (3 - 2 * edges) * (1 - exit);
    return {spread:spread, y:24 * (1 - center) - 8 * exit,
      scale:.98 + .02 * center, alpha:center * (1 - exit), neighborAlpha:neighborAlpha};
  }
  function paintDesktopScene() {
    var scene = sceneValues();
    deck.style.setProperty('--deck-spread', scene.spread.toFixed(5));
    deck.style.setProperty('--deck-y', scene.y.toFixed(3) + 'px');
    deck.style.setProperty('--deck-scale', scene.scale.toFixed(5));
    deck.style.setProperty('--deck-alpha', scene.alpha.toFixed(5));
    deck.style.setProperty('--deck-neighbor-alpha', scene.neighborAlpha.toFixed(5));
  }
  function rest(index) {
    return cards.map(function (_, i) {
      var rel = (i - index + cards.length) % cards.length;
      if (!rel) return {x:0, scale:1, opacity:1, z:3};
      var side = rel > cards.length / 2 ? -1 : 1;
      var neighbour = rel === 1 || rel === cards.length - 1;
      return {x:side * (neighbour ? width * .03 + 16 : width + 32), scale:.94, opacity:neighbour ? 1 : 0, z:1};
    });
  }
  function paint(next) {
    poses = next;
    var scene = sceneValues();
    rendered = next.map(function (p, i) {
      var neighbor = !sceneLocked && i !== active();
      return {x:p.x * (neighbor ? scene.spread : 1), y:(p.y || 0) + scene.y,
        scale:p.scale * scene.scale, opacity:p.opacity * scene.alpha * (neighbor ? scene.spread : 1), z:p.z};
    });
    cards.forEach(function (el, i) {
      var p = rendered[i];
      el.style.transform = 'translate3d(' + p.x.toFixed(3) + 'px,' + p.y.toFixed(3) + 'px,0) scale(' + p.scale.toFixed(5) + ')';
      el.style.opacity = p.opacity.toFixed(4);
      el.style.zIndex = String(p.z);
      el.style.visibility = p.opacity > .001 ? 'visible' : 'hidden';
    });
  }
  function takeover() {
    if (sceneLocked) return;
    // Capture the composed pose before handing it to drag/selection. A touch
    // halfway through an entrance must not teleport to the resting position.
    if (mounted && rendered.length) poses = rendered.map(copy);
    sceneLocked = true;
    if (!mounted) { deck.classList.add('is-scene-takeover'); paintDesktopScene(); }
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; }
  function settle(change, instant, duration) {
    stop();
    if (!mounted) return;
    var target = rest(active());
    if (instant || reduced.matches || document.hidden || !nearby || !poses.length) { paint(target); return; }
    var start = poses.map(copy), began = performance.now();
    function tick(now) {
      var t = clamp((now - began) / (duration || 320), 0, 1), e = ease(t);
      paint(target.map(function (to, i) {
        var from = start[i];
        // Send the complete front card out, then recycle it behind the new front.
        // Its hidden recycling point makes the five-product loop seamless.
        if (change && i === change.previousIndex && i !== active()) {
          if (t < .72) {
            var out = ease(t / .72);
            return {x:from.x + (-change.direction * (width + 20) - from.x) * out, y:from.y * (1 - out),
              scale:from.scale + (.94 - from.scale) * out,
              opacity:from.opacity * (1 - clamp((t - .36) / .36, 0, 1)), z:5};
          }
          return {x:to.x, scale:to.scale, opacity:to.opacity * ease((t - .72) / .28), z:to.z};
        }
        return {x:from.x + (to.x - from.x) * e, y:from.y * (1 - e), scale:from.scale + (to.scale - from.scale) * e,
          opacity:from.opacity + (to.opacity - from.opacity) * e, z:i === active() ? 4 : to.z};
      }));
      if (t < 1) frame = requestAnimationFrame(tick);
      else { frame = 0; paint(target); }
    }
    frame = requestAnimationFrame(tick);
  }
  function release() {
    var old = gesture;
    gesture = null;
    deck.classList.remove('is-dragging');
    if (old && deck.hasPointerCapture(old.id)) deck.releasePointerCapture(old.id);
    return old;
  }
  function cancel(instant) { release(); settle(null, instant); }
  function measure() {
    measureFrame = 0;
    if (!mounted || document.hidden) return;
    var nextWidth = deck.clientWidth;
    if (width !== nextWidth) { width = nextWidth; cancel(true); }
    // Offset height ignores the neighboring cards' scale. Measure outside the
    // scroll/drag frame; inactive articles remain inert and aria-hidden.
    section.style.removeProperty('--mobile-product-head');
    var headHeight = Math.max.apply(null, cards.map(function (card) {
      return card.querySelector('.card__head').offsetHeight;
    }));
    section.style.setProperty('--mobile-product-head', Math.ceil(headHeight) + 'px');
  }
  function requestMeasure() {
    if (!measureFrame && !document.hidden) measureFrame = requestAnimationFrame(measure);
  }
  media.forEach(function (el) {
    var img = el.querySelector('img');
    img.draggable = false;
    var fallback = document.createElement('span');
    fallback.className = 'product-deck__fallback';
    fallback.textContent = img.alt + ' — image unavailable';
    fallback.setAttribute('aria-hidden', 'true');
    el.appendChild(fallback);
    img.addEventListener('error', function () { el.classList.add('has-image-error'); });
    img.addEventListener('load', function () { el.classList.remove('has-image-error'); });
    if (img.complete && !img.naturalWidth) el.classList.add('has-image-error');
  });
  function reconcile() {
    release(); stop();
    mounted = !desktop.matches;
    section.classList.toggle('product--mobile', mounted);
    deck.tabIndex = mounted ? 0 : -1;
    deck.setAttribute('aria-label', mounted
      ? 'Smart toilet collection. Swipe or use the left and right arrow keys to browse.'
      : 'Smart toilet collection');
    cards.forEach(function (el) {
      if (!mounted) {
        ['transform','opacity','z-index','visibility'].forEach(function (key) { el.style.removeProperty(key); });
      }
    });
    if (mounted) { width = deck.clientWidth; paint(rest(active())); requestMeasure(); }
    else { section.style.removeProperty('--mobile-product-head'); paintDesktopScene(); }
  }
  deck.addEventListener('pointerdown', function (event) {
    if (!mounted || event.button !== 0) return;
    if (gesture || event.isPrimary === false) { cancel(false); return; }
    // Disclosures keep native click and focus behavior. The rest of the card,
    // including its text and feature list, can start a horizontal drag.
    if (event.target.closest('button, a, input, textarea, select, [contenteditable]')) return;
    takeover();
    stop();
    gesture = {id:event.pointerId, x:event.clientX, y:event.clientY, dx:0, horizontal:false,
      start:poses.map(copy), samples:[{x:event.clientX, time:event.timeStamp}]};
    deck.setPointerCapture(event.pointerId);
  });
  function sample(event) {
    var points = gesture.samples;
    points.push({x:event.clientX, time:event.timeStamp});
    while (points.length > 2 && points[1].time < event.timeStamp - 80) points.shift();
  }
  deck.addEventListener('pointermove', function (event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    var dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.horizontal) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.3) { cancel(false); return; }
      gesture.horizontal = true;
      deck.classList.add('is-dragging');
    }
    if (event.cancelable) event.preventDefault();
    sample(event);
    gesture.dx = clamp(dx, -width, width);
    var direction = dx < 0 ? 1 : -1;
    var incoming = (active() + direction + cards.length) % cards.length;
    var progress = clamp(Math.abs(dx) / width, 0, 1);
    var next = gesture.start.map(copy);
    next[active()].x += gesture.dx;
    next[active()].scale -= .04 * progress;
    next[active()].z = 5;
    next[incoming].x *= 1 - progress;
    next[incoming].scale += (1 - next[incoming].scale) * progress;
    next[incoming].opacity = 1;
    next[incoming].z = 4;
    // Pointer events can arrive faster than the display: publish once per frame.
    stop();
    frame = requestAnimationFrame(function () { frame = 0; paint(next); });
  });
  deck.addEventListener('pointerup', function (event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    sample(event);
    var g = release(), points = g.samples;
    var first = points[0], last = points[points.length - 1];
    var velocity = (last.x - first.x) / Math.max(1, last.time - first.time);
    var advance = g.horizontal && (Math.abs(g.dx) >= width * .18
      || (Math.abs(g.dx) >= 12 && Math.abs(velocity) >= .45 && velocity * g.dx > 0));
    if (advance) carousel.changeProduct(g.dx < 0 ? 1 : -1, 'drag');
    else settle(null, false);
  });
  ['pointercancel','lostpointercapture'].forEach(function (type) {
    deck.addEventListener(type, function (event) { if (gesture && gesture.id === event.pointerId) cancel(false); });
  });
  carousel.cardDeck = {
    change:function (change) { takeover(); release(); settle(change, false); },
    takeover:takeover,
    setSceneProgress:function (entry, exit, visible) {
      sceneEntry = entry; sceneExit = exit;
      if (!visible && sceneLocked) {
        sceneLocked = false; deck.classList.remove('is-scene-takeover');
        if (mounted) { release(); stop(); poses = rest(active()); }
      }
      if (sceneLocked) return;
      if (mounted) paint(poses.length ? poses : rest(active()));
      else paintDesktopScene();
    },
    measure:requestMeasure,
    element:deck
  };
  carousel.addEventListener('pointerdown', function (event) {
    if (event.button === 0 && event.isPrimary !== false) takeover();
  }, {capture:true, passive:true});
  carousel.addEventListener('focusin', takeover);
  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', function () { cancel(true); });
  window.addEventListener('resize', function () { if (mounted) { cancel(true); requestMeasure(); } }, {passive:true});
  new ResizeObserver(requestMeasure).observe(carousel);
  if (document.fonts) document.fonts.ready.then(requestMeasure);
  new IntersectionObserver(function (entries) {
    nearby = entries[0].isIntersecting;
    if (!nearby && mounted) cancel(true);
  }, {rootMargin:'80px'}).observe(deck);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancel(true); cancelAnimationFrame(measureFrame); measureFrame = 0; }
    else requestMeasure();
  });
  reconcile();
})();
