/* Position-driven scenes. main.js owns the scroll frame; interactions keep
   their own clocks. HTML remains readable until this controller is ready. */
(function () {
  'use strict';
  // Pure timeline functions: no elapsed time, direction flags or replay state.
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function range(value, start, end) { return clamp((value - start) / Math.max(.00001, end - start)); }
  function ease(value) { return 1 - Math.pow(1 - clamp(value), 3); }
  function scenePose(top, height, scroll, viewport, header, maximum) {
    var end = Math.min(maximum, top - viewport * .62);
    var start = Math.min(end - Math.min(120, viewport * .14), top - viewport * .88);
    return {
      entry:range(scroll, start, end),
      exit:range(scroll, top + height - header - Math.min(72, viewport * .08), top + height - header)
    };
  }
  function wordPose(entry, index, count, intro) {
    var order = count > 1 ? index / (count - 1) : 0;
    return ease(range(entry, (intro ? .24 : .4) + .22 * order, (intro ? .66 : .68) + .22 * order));
  }
  function departure(covered) { return ease(range(covered, .6, 1)); }

  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  var targets = [], dirty = true, viewport = 0, headerHeight = 0, maximum = 0;
  var carousel = document.querySelector('.carousel');
  var why = document.getElementById('why-us');
  var whyScenes = [];
  var whySceneMap = new WeakMap();
  var request = function () {
    if (window.siteScroll && window.siteScroll.requestFrame) window.siteScroll.requestFrame();
  };
  function invalidate() { dirty = true; request(); }
  function phraseWindows(title) {
    Array.from(title.childNodes).filter(function (node) {
      return node.nodeName !== 'BR' && node.textContent.trim();
    }).forEach(function (node, index) {
      var mask = document.createElement('span'), phrase = document.createElement('span');
      mask.className = 'motion-window'; phrase.className = 'motion-phrase';
      mask.style.setProperty('--phrase-order', index);
      node.parentNode.insertBefore(mask, node); phrase.appendChild(node); mask.appendChild(phrase);
    });
    title.classList.add('motion-title');
  }
  document.querySelectorAll('#technology h2, #product h2, .contact__title, .mobile-menu__nav a, #why-us .slide:not(.slide--intro) .slide__title').forEach(phraseWindows);

  // Split text nodes, retaining the original emphasis elements, spaces and <br>s.
  // An accessible heading name avoids fragmented speech or duplicate copies.
  function splitWords(title) {
    var words = [];
    function visit(parent) {
      Array.from(parent.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          var fragment = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(part)); return; }
            var word = document.createElement('span');
            word.className = 'why-word'; word.textContent = part;
            word.setAttribute('aria-hidden', 'true'); words.push(word); fragment.appendChild(word);
          });
          parent.replaceChild(fragment, node);
        } else if (node.nodeName !== 'BR') visit(node);
      });
    }
    var label = title.innerText.replace(/\s+/g, ' ').trim();
    visit(title); title.setAttribute('aria-label', label);
    return words;
  }
  if (why) {
    why.querySelectorAll('.slide').forEach(function (slide, index) {
      var title = slide.querySelector('.slide__title');
      var note = slide.querySelector('.slide__note');
      var notes = [];
      if (index === 0 && note) {
        var line = document.createElement('span'); line.className = 'why-note-line';
        Array.from(note.childNodes).forEach(function (node) {
          if (node.nodeName === 'BR') {
            note.insertBefore(line, node); line = document.createElement('span'); line.className = 'why-note-line';
          } else line.appendChild(node);
        });
        note.appendChild(line); notes = Array.from(note.querySelectorAll('.why-note-line'));
      } else if (note) notes = [note];
      var scene = {slide:slide, role:slide.dataset.whyScene, words:splitWords(title), notes:notes,
        pills:Array.from(slide.querySelectorAll('.pill')), marks:Array.from(slide.querySelectorAll('.trust__mark')), signature:null};
      whyScenes.push(scene); whySceneMap.set(slide, scene);
    });
    why.classList.add('why--words');
  }

  function add(selector, kind, rise) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.classList.add('scene-' + kind);
      var phrases = kind === 'heading' ? Array.from(el.querySelectorAll('.motion-phrase')) : [];
      targets.push({el:el, kind:kind, rise:rise || 24, phrases:phrases, top:0, height:0, locked:false, signature:null});
    });
  }
  add('#product h2, .contact__title', 'heading');
  add('#product .section-head__sub, .contact__text', 'rise');
  add('.contact__fields .field:not(.field--hp)', 'field', 16);
  add('.contact__form .submit', 'rise', 16);
  add('.collection-shell, #support', 'boundary');
  add('#footer .logo, #footer .footer__tagline, #footer .footer__col, #footer .footer__copy', 'rise', 12);
  add('#footer .footer__rule', 'rule');
  if (carousel && carousel.cardDeck) add('.carousel__stage', 'deck');

  function layoutTop(el) {
    var top = 0;
    for (var node = el; node; node = node.offsetParent) top += node.offsetTop;
    return top;
  }
  function measure(height) {
    viewport = height;
    headerHeight = document.querySelector('.topbar').offsetHeight;
    maximum = Math.max(0, document.documentElement.scrollHeight - height);
    targets.forEach(function (target) {
      var anchor = target.el;
      // Paired laptop/tablet fields share a clock. On phones their rows stack.
      var row = target.kind === 'field' && anchor.closest('.field-row');
      if (row && row.offsetHeight <= anchor.offsetHeight + 2) anchor = row;
      target.top = layoutTop(anchor); target.height = anchor.offsetHeight;
      if (target.kind === 'boundary') target.height = 1;
      target.signature = null;
    });
    dirty = false;
  }
  function read(scroll, height) {
    if (document.hidden) return null;
    if (dirty || viewport !== height) measure(height);
    return targets.map(function (target) {
      var fullyOutside = target.top - scroll >= height || target.top + target.height - scroll <= 0;
      // Values and invalid fields stay still; focus alone releases after leaving view.
      if (fullyOutside && !target.el.contains(document.activeElement)) target.locked = false;
      var editing = target.kind === 'field' && (target.locked || target.el.matches(':focus-within')
        || target.el.classList.contains('is-invalid') || Array.from(target.el.querySelectorAll('input,textarea')).some(function (input) { return input.value; }));
      var pose = reduced.matches || editing || target.locked ? {entry:1,exit:0}
        : scenePose(target.top, target.height, scroll, height, headerHeight, maximum);
      return {target:target, entry:pose.entry, exit:pose.exit, outside:fullyOutside};
    });
  }
  function render(states) {
    if (!states || document.hidden) return;
    states.forEach(function (state) {
      var target = state.target, el = target.el;
      var signature = state.entry.toFixed(5) + '/' + state.exit.toFixed(5) + '/' + state.outside;
      // Offscreen scenes receive their clamped endpoint once, then stay idle.
      if (signature === target.signature) return;
      target.signature = signature;
      var entry = ease(state.entry), exit = ease(state.exit);
      if (target.kind === 'deck') {
        carousel.cardDeck.setSceneProgress(state.entry, exit, !state.outside);
      } else if (target.kind === 'heading') {
        target.phrases.forEach(function (phrase, i) {
          var p = ease(range(state.entry, i * .12, .86 + i * .12));
          phrase.style.opacity = (p * (1 - exit)).toFixed(5);
          phrase.style.transform = 'translate3d(0,calc(' + (1 - p).toFixed(5) + ' * .8em - ' + (8 * exit).toFixed(3) + 'px),0)';
        });
      } else if (target.kind === 'boundary' || target.kind === 'rule') {
        el.style.setProperty('--scene-rule', entry.toFixed(5));
      } else {
        el.style.opacity = (entry * (1 - exit)).toFixed(5);
        el.style.transform = 'translate3d(0,' + (target.rise * (1 - entry) - 8 * exit).toFixed(3) + 'px,0)';
        if (target.kind === 'field') el.style.setProperty('--scene-rule', entry.toFixed(5));
      }
    });
    document.documentElement.classList.add('scene-motion-ready');
  }
  function paintWhy(slide, index, entry, covered, animated) {
    var scene = whySceneMap.get(slide);
    if (!scene) return;
    var still = reduced.matches || !animated;
    var exit = still || scene.role === 'warranty' ? 0 : departure(covered);
    var signature = entry.toFixed(5) + '/' + exit.toFixed(5) + '/' + still;
    if (signature === scene.signature) return;
    scene.signature = signature;
    scene.words.forEach(function (word, i) {
      var p = still ? 1 : wordPose(entry, i, scene.words.length, scene.role === 'intro');
      word.style.opacity = ((.24 + .76 * p) * (1 - exit)).toFixed(5);
      var scale = scene.role === 'focus' && i === 0 ? 1 + .04 * (1 - p) : 1;
      word.style.transform = 'translate3d(0,calc(' + (.35 * (1 - p)).toFixed(5) + 'em - ' + (8 * exit).toFixed(3) + 'px),0) scale(' + scale.toFixed(5) + ')';
    });
    scene.notes.forEach(function (note, i) {
      var p = still ? 1 : ease(range(entry, scene.role === 'intro' ? .56 + i * .06 : .72, .96 + i * .02));
      note.style.opacity = (p * (1 - exit)).toFixed(5);
      note.style.transform = 'translate3d(0,' + (16 * (1 - p) - 8 * exit).toFixed(3) + 'px,0)';
    });
    scene.pills.forEach(function (pill, i) {
      var p = still ? 1 : ease(range(entry, .72 + i * .06, .92 + i * .06));
      var x = scene.role === 'service' ? (i ? 12 : -12) * (1 - p) : 0;
      pill.style.opacity = (p * (1 - exit)).toFixed(5);
      pill.style.transform = 'translate3d(' + x.toFixed(3) + 'px,' + (16 * (1 - p) - 8 * exit).toFixed(3) + 'px,0) scale(' + (scene.role === 'patents' ? .96 + .04 * p : 1).toFixed(5) + ')';
    });
    scene.marks.forEach(function (mark, i) {
      var p = still ? 1 : ease(range(entry, .68 + i * .035, .87 + i * .035));
      mark.style.opacity = (p * (1 - exit)).toFixed(5);
      mark.style.transform = 'translate3d(0,' + (14 * (1 - p) - 8 * exit).toFixed(3) + 'px,0)';
    });
  }
  document.addEventListener('focusin', function (event) {
    targets.forEach(function (target) {
      if (target.kind !== 'boundary' && target.kind !== 'deck' && target.el.contains(event.target)) { target.locked = true; target.signature = null; }
    });
    request();
  });
  document.addEventListener('input', invalidate);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) invalidate(); });
  window.addEventListener('resize', invalidate, {passive:true});
  window.addEventListener('pageshow', invalidate);
  window.addEventListener('load', invalidate, {once:true});
  desktop.addEventListener('change', invalidate);
  reduced.addEventListener('change', function () { whyScenes.forEach(function (scene) { scene.signature = null; }); invalidate(); });
  if (document.fonts) document.fonts.ready.then(invalidate);
  if ('ResizeObserver' in window) {
    var observer = new ResizeObserver(invalidate);
    document.querySelectorAll('#technology, #why-us, #product, #support, #footer, .topbar').forEach(function (el) { observer.observe(el); });
    targets.forEach(function (target) { observer.observe(target.el); });
  }
  window.siteMotion = {read:read, render:render, paintWhy:paintWhy, invalidate:invalidate};
  // The legacy Why controller may have painted before this deferred script loaded.
  if (window.siteScroll && window.siteScroll.refreshWhy) window.siteScroll.refreshWhy();
  request();
})();
