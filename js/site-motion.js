/* Position-driven scenes. main.js owns the scroll frame; interactions keep
   their own clocks. HTML remains readable until this controller is ready. */
(function () {
  'use strict';
  // Pure timeline functions: no elapsed time, direction flags or replay state.
  function clamp(value) { return Math.max(0, Math.min(1, value)); }
  function range(value, start, end) { return clamp((value - start) / Math.max(.00001, end - start)); }
  function ease(value) { return 1 - Math.pow(1 - clamp(value), 3); }
  function smooth(value) { value = clamp(value); return value * value * (3 - 2 * value); }
  // Overlapping reading-order wave: item i starts later but every item takes `span`.
  function stagger(entry, index, count, span) {
    var step = count > 1 ? (1 - span) / (count - 1) : 0;
    return range(entry, index * step, index * step + span);
  }
  // Give the desktop handoff room inside its existing geometry. Wheel distance
  // stays uniform; only the entrance poses span more of the visible viewport.
  var collectionWindows = {
    boundary: {start:.94, end:.58},
    heading: {start:.90, end:.48},
    rise: {start:.90, end:.48},
    deck: {start:.88, end:.28}
  };
  // The phone deck is taller than the screen; assemble it across most of it.
  var mobileWindows = {deck: {start:.98, end:.3}};
  function scenePose(top, height, scroll, viewport, header, maximum, entrance) {
    var end = Math.min(maximum, top - viewport * (entrance ? entrance.end : .62));
    var start = Math.min(end - Math.min(120, viewport * .14), top - viewport * (entrance ? entrance.start : .88));
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
  var technology = document.getElementById('technology');
  var stage = technology && technology.parentElement.classList.contains('tech-stage') ? technology.parentElement : null;
  var footer = document.getElementById('footer');
  var support = document.getElementById('support');
  var root = document.documentElement;
  var footerScene = null, footerReveal = false;
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
  document.querySelectorAll('.mobile-menu__nav a, #why-us .slide:not(.slide--intro) .slide__title').forEach(phraseWindows);

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
  // Masked units for cinematic type: each word (or letter) rises through its
  // own baseline window. Emphasis elements and natural wrapping are retained.
  function splitMasked(el, letters, label) {
    var units = [];
    var name = el.innerText.replace(/\s+/g, ' ').trim();
    function visit(parent) {
      Array.from(parent.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          var fragment = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { fragment.appendChild(document.createTextNode(part)); return; }
            var mask = document.createElement('span');
            mask.className = 'mo-mask';
            var unit = {mask:mask, parts:[], line:0, strong:!!parent.closest('strong')};
            (letters ? Array.from(part) : [part]).forEach(function (text) {
              var inner = document.createElement('span');
              inner.className = letters ? 'mo-letter' : 'mo-word';
              inner.textContent = text;
              mask.appendChild(inner); unit.parts.push(inner);
            });
            if (label) mask.setAttribute('aria-hidden', 'true');
            units.push(unit); fragment.appendChild(mask);
          });
          parent.replaceChild(fragment, node);
        } else if (node.nodeType === 1 && node.nodeName !== 'BR') visit(node);
      });
    }
    visit(el);
    if (label) el.setAttribute('aria-label', name);
    return units;
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

  // Each target may follow its own position (default), an anchor's position
  // (one shared clock for a whole section), or stay still (null) per layout.
  function push(el, kind, options) {
    options = options || {};
    el.classList.add('scene-' + kind);
    var target = {el:el, kind:kind, rise:options.rise || 24, units:options.units || [],
      desktop:options.desktop, mobile:options.mobile, noExit:!!options.noExit, parallax:options.parallax || 0,
      top:0, height:0, anchorTop:0, locked:false, signature:null};
    targets.push(target);
    return target;
  }
  function add(selector, kind, rise, options) {
    document.querySelectorAll(selector).forEach(function (el) {
      var o = Object.assign({rise:rise}, options || {});
      if (o.desktop === undefined && el.matches('.collection-shell, #product *')) o.desktop = {window:collectionWindows[kind === 'words' ? 'heading' : kind]};
      push(el, kind, o);
    });
  }
  function addText(selector, kind, options) {
    document.querySelectorAll(selector).forEach(function (el) {
      var o = Object.assign({}, options || {});
      o.units = splitMasked(el, kind === 'letters', kind !== 'lines');
      if (o.desktop === undefined && el.matches('#product *')) o.desktop = {window:collectionWindows.heading};
      push(el, kind, o);
    });
  }
  var techAnchor = stage || technology;
  function techClock(start, end) { return {anchor:techAnchor, window:{start:start, end:end}}; }
  if (technology) {
    // Technology rises with the Cloud to Clarity handoff: one section clock.
    addText('#technology .section-head__title', 'words', {desktop:techClock(.96, .5), mobile:techClock(.96, .5), noExit:true});
    addText('#technology .section-head__sub', 'words', {desktop:techClock(.9, .4), mobile:techClock(.92, .42), noExit:true});
    push(technology.querySelector('.features__media'), 'media', {desktop:techClock(.86, .12), mobile:null, noExit:true});
    var rows = Array.from(technology.querySelectorAll('.feature'));
    rows.forEach(function (row, i) {
      push(row, 'row', {rise:22, desktop:techClock(.8 - .045 * i, .36 - .045 * i), noExit:true});
    });
    technology.querySelectorAll('.feature__mobile-photo').forEach(function (photo) {
      push(photo, 'photo', {desktop:null, mobile:{window:{start:1, end:.7}}, noExit:true});
    });
  }
  addText('#product h2', 'words');
  addText('#product .section-head__sub', 'words', {desktop:{window:collectionWindows.rise}});
  addText('.contact__title', 'letters', {parallax:.08});
  addText('.contact__text', 'lines');
  add('.contact__fields .field:not(.field--hp)', 'field', 28);
  add('.contact__form .submit', 'sweep', 16);
  add('.collection-shell, #support', 'boundary');
  if (carousel && carousel.cardDeck) add('.carousel__stage', 'deck', 0, {mobile:{window:mobileWindows.deck}});

  // The footer is revealed from beneath Support; its own clock is that reveal.
  if (footer) {
    var footerItems = [];
    var tagline = footer.querySelector('.footer__tagline');
    var taglineUnits = tagline ? splitMasked(tagline, false, true) : [];
    footer.querySelectorAll('.logo, .footer__tagline, .footer__col h3, .footer__col a, .footer__rule, .footer__copy').forEach(function (el) {
      el.classList.add('scene-footer');
      if (el.matches('.footer__rule')) el.classList.add('scene-rule');
      footerItems.push({el:el, kind:el.matches('.footer__rule') ? 'rule' : el.matches('.logo') ? 'logo' : el === tagline ? 'tagline' : 'rise'});
    });
    footerScene = {items:footerItems, tagline:taglineUnits, height:0, signature:null};
  }

  // Restore kerning between split letters; canvas pairs measure the font's own
  // adjustments, stored in em so they survive responsive type scaling.
  var kernContext = document.createElement('canvas').getContext('2d');
  function kern(target) {
    var style = getComputedStyle(target.el), size = parseFloat(style.fontSize);
    if (!size || !kernContext) return;
    kernContext.font = style.fontStyle + ' ' + style.fontWeight + ' ' + size + 'px ' + style.fontFamily;
    target.units.forEach(function (unit) {
      unit.parts.forEach(function (part, i) {
        var next = unit.parts[i + 1];
        if (!next) { part.style.marginRight = ''; return; }
        var a = part.textContent, b = next.textContent;
        var k = (kernContext.measureText(a + b).width - kernContext.measureText(a).width - kernContext.measureText(b).width) / size;
        part.style.marginRight = Math.abs(k) > .002 ? k.toFixed(4) + 'em' : '';
      });
    });
  }

  function layoutTop(el) {
    var top = 0;
    for (var node = el; node; node = node.offsetParent) {
      // Technology may be pinned; its flow position is the stage's.
      if (node === technology && stage) return top + layoutTop(stage);
      top += node.offsetTop;
    }
    return top;
  }
  function mode() { return desktop.matches ? 'desktop' : 'mobile'; }
  function measure(height) {
    viewport = height;
    headerHeight = document.querySelector('.topbar').offsetHeight;
    maximum = Math.max(0, document.documentElement.scrollHeight - height);
    var m = mode();
    targets.forEach(function (target) {
      var anchor = target.el;
      // Paired laptop/tablet fields share a clock. On phones their rows stack.
      var row = target.kind === 'field' && anchor.closest('.field-row');
      if (row && row.offsetHeight <= anchor.offsetHeight + 2) anchor = row;
      target.top = layoutTop(anchor); target.height = anchor.offsetHeight;
      if (target.kind === 'boundary') target.height = 1;
      var config = target[m];
      target.anchorTop = config && config.anchor ? layoutTop(config.anchor) : target.top;
      if (target.kind === 'letters') kern(target);
      if (target.kind === 'lines') {
        var tops = [];
        target.units.forEach(function (unit) {
          var y = Math.round(unit.mask.offsetTop);
          if (tops.indexOf(y) < 0) tops.push(y);
        });
        tops.sort(function (a, b) { return a - b; });
        target.units.forEach(function (unit) { unit.line = tops.indexOf(Math.round(unit.mask.offsetTop)); });
        target.lines = tops.length;
      }
      target.signature = null;
    });
    if (footerScene) {
      footerScene.height = footer.offsetHeight;
      footerScene.signature = null;
      footerReveal = !reduced.matches && !!support && footerScene.height <= height * .92;
      root.classList.toggle('footer-reveal', footerReveal);
    }
    dirty = false;
  }
  function read(scroll, height) {
    if (document.hidden) return null;
    if (dirty || viewport !== height) measure(height);
    var m = mode();
    var states = targets.map(function (target) {
      var fullyOutside = target.top - scroll >= height || target.top + target.height - scroll <= 0;
      // Values and invalid fields stay still; focus alone releases after leaving view.
      if (fullyOutside && !target.el.contains(document.activeElement)) target.locked = false;
      var editing = target.kind === 'field' && (target.locked || target.el.matches(':focus-within')
        || target.el.classList.contains('is-invalid') || Array.from(target.el.querySelectorAll('input,textarea')).some(function (input) { return input.value; }));
      var config = target[m];
      var pose = reduced.matches || editing || target.locked || config === null ? {entry:1, exit:0}
        : scenePose(target.anchorTop, target.height, scroll, height, headerHeight, maximum, config && config.window);
      if (target.noExit) pose.exit = 0;
      var shift = 0;
      if (target.parallax && !reduced.matches) {
        // Drift slower than the page while in view: a function of position only.
        var centre = target.top + target.height / 2 - height / 2;
        shift = Math.max(-56, Math.min(56, target.parallax * (scroll - centre)));
      }
      return {target:target, entry:pose.entry, exit:pose.exit, outside:fullyOutside, shift:shift};
    });
    var footerProgress = 1;
    if (footerScene && !reduced.matches) footerProgress = clamp((scroll - (maximum - footerScene.height)) / Math.max(1, footerScene.height));
    return {targets:states, footer:footerProgress, scroll:scroll};
  }
  function riseUnits(units, entry, letters, lines) {
    var count = lines || (letters ? units.reduce(function (n, u) { return n + u.parts.length; }, 0) : units.length);
    var index = 0;
    units.forEach(function (unit) {
      unit.parts.forEach(function (part) {
        var order = lines ? unit.line + (unit.strong ? .6 : 0) : index;
        var p = ease(stagger(entry, Math.min(order, count - 1), count, letters ? .5 : lines ? .58 : .62));
        index++;
        if (p >= 1) { part.style.transform = ''; part.style.opacity = ''; part.style.willChange = ''; return; }
        part.style.transform = letters
          ? 'translate3d(0,' + ((1 - p) * 118).toFixed(3) + '%,0) rotate(' + ((1 - p) * 7).toFixed(3) + 'deg)'
          : 'translate3d(0,' + ((1 - p) * 112).toFixed(3) + '%,0)';
        part.style.opacity = clamp(p * 1.5).toFixed(4);
        part.style.willChange = p > 0 ? 'transform,opacity' : '';
      });
    });
  }
  function render(frame) {
    if (!frame || document.hidden) return;
    frame.targets.forEach(function (state) {
      var target = state.target, el = target.el;
      var signature = state.entry.toFixed(5) + '/' + state.exit.toFixed(5) + '/' + state.outside + '/' + state.shift.toFixed(2);
      // Offscreen scenes receive their clamped endpoint once, then stay idle.
      if (signature === target.signature) return;
      target.signature = signature;
      var entry = ease(state.entry), exit = ease(state.exit);
      if (target.kind === 'deck') {
        carousel.cardDeck.setSceneProgress(state.entry, exit, !state.outside);
      } else if (target.kind === 'words' || target.kind === 'letters' || target.kind === 'lines') {
        riseUnits(target.units, state.entry, target.kind === 'letters', target.kind === 'lines' ? target.lines : 0);
        el.style.opacity = exit ? (1 - exit).toFixed(5) : '';
        var y = state.shift - 8 * exit;
        el.style.transform = Math.abs(y) > .01 ? 'translate3d(0,' + y.toFixed(3) + 'px,0)' : '';
      } else if (target.kind === 'boundary') {
        el.style.setProperty('--scene-rule', entry.toFixed(5));
      } else if (target.kind === 'media' || target.kind === 'photo') {
        // A framed window opens to the full panel while the photo settles from depth.
        var a = 1 - smooth(state.entry);
        var desktopMedia = target.kind === 'media';
        el.style.clipPath = a > .0005
          ? 'inset(' + (a * (desktopMedia ? 12 : 7)).toFixed(3) + '% ' + (a * (desktopMedia ? 14 : 6)).toFixed(3) + '% round ' + (a * (desktopMedia ? 28 : 18)).toFixed(2) + 'px)'
          : '';
        el.style.setProperty(desktopMedia ? '--tech-media-scale' : '--tech-photo-scale', (1 + a * (desktopMedia ? .18 : .14)).toFixed(5));
        el.style.willChange = a > .0005 && a < .9995 ? 'clip-path' : '';
      } else if (target.kind === 'row') {
        var r = ease(range(state.entry, 0, .82));
        el.style.opacity = r < 1 ? r.toFixed(5) : '';
        el.style.transform = r < 1 ? 'translate3d(0,' + (target.rise * (1 - r)).toFixed(3) + 'px,0)' : '';
        el.style.setProperty('--row-rule', smooth(range(state.entry, .2, 1)).toFixed(5));
      } else if (target.kind === 'sweep') {
        var lift = ease(range(state.entry, 0, .7)), fill = smooth(range(state.entry, .18, 1));
        el.style.opacity = (lift * (1 - exit)).toFixed(5);
        el.style.transform = 'translate3d(0,' + (target.rise * (1 - lift) - 8 * exit).toFixed(3) + 'px,0)';
        el.style.clipPath = fill < .9995 ? 'inset(0 ' + ((1 - fill) * 100).toFixed(3) + '% 0 0 round 110px)' : '';
      } else {
        // Fields: rows rise first, then their underline draws beneath them.
        var rise = ease(range(state.entry, 0, .75));
        el.style.opacity = (rise * (1 - exit)).toFixed(5);
        el.style.transform = 'translate3d(0,' + (target.rise * (1 - rise) - 8 * exit).toFixed(3) + 'px,0)';
        el.style.setProperty('--scene-rule', smooth(range(state.entry, .3, 1)).toFixed(5));
      }
    });
    if (footerScene) paintFooter(frame.footer);
    root.classList.add('scene-motion-ready');
  }
  function paintFooter(q) {
    var signature = q.toFixed(5) + '/' + footerReveal;
    if (signature === footerScene.signature) return;
    footerScene.signature = signature;
    // Hidden until Support starts lifting, so the sticky footer never shows elsewhere.
    root.classList.toggle('footer-covered', footerReveal && q <= 0);
    var count = footerScene.items.length;
    footerScene.items.forEach(function (item, i) {
      var start = .04 + .5 * i / Math.max(1, count - 1);
      var p = ease(range(q, start, start + .42));
      var el = item.el;
      if (item.kind === 'rule') {
        el.style.setProperty('--scene-rule', smooth(range(q, .38, .9)).toFixed(5));
      } else if (item.kind === 'logo') {
        el.style.opacity = p < 1 ? p.toFixed(5) : '';
        el.style.transform = p < 1 ? 'translate3d(0,' + (18 * (1 - p)).toFixed(3) + 'px,0) scale(' + (.9 + .1 * p).toFixed(5) + ')' : '';
      } else if (item.kind === 'tagline') {
        riseUnits(footerScene.tagline, range(q, start, start + .5), false, 0);
      } else {
        el.style.opacity = p < 1 ? p.toFixed(5) : '';
        el.style.transform = p < 1 ? 'translate3d(0,' + (20 * (1 - p)).toFixed(3) + 'px,0)' : '';
      }
    });
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
  // A tapped feature photo appears complete; interaction wins over scroll.
  if (technology) technology.addEventListener('click', function (event) {
    if (desktop.matches || !event.target.closest('.feature__btn')) return;
    targets.forEach(function (target) {
      if (target.kind === 'photo') { target.locked = true; target.signature = null; }
    });
    invalidate();
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
