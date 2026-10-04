/* First Principle — interactions and scroll animation; layout belongs to CSS. */
(function () {
  "use strict";

  var desktopMedia = window.matchMedia("(min-width: 1100px)");
  var isDesktop = function () { return desktopMedia.matches; };
  var shortScreen = window.matchMedia("(max-height: 520px)");
  var wideScreen = window.matchMedia("(min-aspect-ratio: 11 / 5)");

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector(".hamburger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    var menuBackground = Array.prototype.slice.call(document.querySelectorAll('.hero, main, .footer, .skip-link'));
    var previousInert = [];
    var previousOverflow = "";
    var menuOpen = false;
    var menuCloseTimer = 0;
    var menuMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    var measureMenuOrigin = function () {
      var buttonRect = burger.getBoundingClientRect();
      var panelRect = menu.getBoundingClientRect();
      var x = buttonRect.left + buttonRect.width / 2 - panelRect.left;
      var y = buttonRect.top + buttonRect.height / 2 - panelRect.top;
      // Reach the farthest corner in every orientation, starting at the icon.
      var radius = Math.ceil(Math.hypot(Math.max(x, panelRect.width - x), Math.max(y, panelRect.height - y))) + 1;
      menu.style.setProperty('--menu-x', x + 'px');
      menu.style.setProperty('--menu-y', y + 'px');
      menu.style.setProperty('--menu-radius', radius + 'px');
    };
    var finishMenuClose = function () {
      if (menuOpen) return;
      window.clearTimeout(menuCloseTimer);
      menu.hidden = true;
      menu.inert = true;
      menu.classList.remove('is-closing');
      document.body.classList.remove('menu-open');
      document.body.style.overflow = previousOverflow;
      menuBackground.forEach(function (el, i) { el.inert = previousInert[i]; });
      if (typeof requestFrame === "function") requestFrame();
    };
    var setMenu = function (open, restoreFocus, instant) {
      if (open === menuOpen && !instant) return;
      if (open && isDesktop()) return;
      window.clearTimeout(menuCloseTimer);
      // Capture page state only once, including when a closing motion reverses.
      if (open && menu.hidden) {
        previousOverflow = document.body.style.overflow;
        previousInert = menuBackground.map(function (el) { return el.inert; });
      }
      menuOpen = open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : previousOverflow;
      if (open) {
        var wasHidden = menu.hidden;
        menu.hidden = false;
        menu.inert = false;
        document.body.classList.add('menu-open');
        menuBackground.forEach(function (el) { el.inert = true; });
        measureMenuOrigin();
        menu.classList.remove('is-closing');
        // Establish the collapsed pose before the first reveal. Later toggles
        // reverse the current CSS transition rather than jumping to an endpoint.
        if (wasHidden) window.getComputedStyle(menu).clipPath;
        menu.classList.add('is-open');
        var first = menu.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      } else {
        if (restoreFocus !== false) burger.focus({ preventScroll: true });
        menu.inert = true;
        menu.classList.add('is-closing');
        menu.classList.remove('is-open');
        if (instant || menuMotion.matches) finishMenuClose();
        // transitionend is authoritative; the bounded fallback also handles
        // canceled transitions, browser suspension and rapid repeated taps.
        else menuCloseTimer = window.setTimeout(finishMenuClose, 360);
      }
      if (typeof requestFrame === "function") requestFrame();
    };
    burger.addEventListener("click", function () { setMenu(!menuOpen); });
    menu.addEventListener('transitionend', function (event) {
      if (event.target === menu && event.propertyName === 'clip-path' && !menuOpen) finishMenuClose();
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.querySelectorAll('.topbar__brand, .topbar__contact').forEach(function (a) {
      a.addEventListener("click", function () { if (menuOpen) setMenu(false, false); });
    });
    document.addEventListener("keydown", function (e) {
      if (!menuOpen) return;
      if (e.key === "Escape") { e.preventDefault(); setMenu(false); }
      if (e.key === "Tab") {
        var controls = Array.prototype.slice.call(document.querySelectorAll('.topbar a[href], .topbar button, #mobile-menu a[href]')).filter(function (el) { return el.getClientRects().length; });
        var first = controls[0], last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    desktopMedia.addEventListener("change", function (mq) {
      if (mq.matches && !menu.hidden) { setMenu(false, false, true); document.querySelector('.topbar__brand').focus({ preventScroll: true }); }
    });
    window.addEventListener('resize', function () {
      if (!menu.hidden && !isDesktop()) window.requestAnimationFrame(measureMenuOrigin);
    }, { passive: true });
    menuMotion.addEventListener('change', function (event) {
      if (event.matches && !menuOpen && !menu.hidden) finishMenuClose();
    });
  }

  // Technology interactions live in technology.js; page scrolling never selects a card.

  /* ---------------- Collection carousel (5 products, 3 visible on desktop) ---------------- */
  var carousel = document.querySelector(".carousel");
  if (carousel) {
    var cards = Array.prototype.slice.call(carousel.querySelectorAll(".card"));
    var status = document.getElementById("carousel-status");
    var counter = carousel.querySelector('.carousel__counter');
    var n = cards.length;
    var active = parseInt(carousel.dataset.active, 10) || 0;

    var layout = function () {
      cards.forEach(function (card) {
        var i = parseInt(card.dataset.index, 10);
        var rel = (i - active + n) % n;
        if (rel === 0) card.dataset.pos = "center";
        else if (rel === n - 1) card.dataset.pos = "left";
        else if (rel === 1) card.dataset.pos = "right";
        else if (rel === n - 2) card.dataset.pos = "out-left";
        else if (rel === 2) card.dataset.pos = "out-right";
        else card.removeAttribute("data-pos");
        card.setAttribute("aria-hidden", rel === 0 ? "false" : "true");
        card.inert = rel !== 0;
      });
      // Eager-load the neighbours so the next click is instant.
      cards.forEach(function (card) {
        if (card.dataset.pos) card.querySelectorAll("img[loading=lazy]").forEach(function (img) { img.loading = "eager"; });
      });
      if (status) {
        var name = cards[active].querySelector("h3");
        status.textContent = "Showing " + (name ? name.textContent : "") + ", " + (active + 1) + " of " + n;
      }
      if (counter) counter.textContent = String(active + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    };

    carousel.changeProduct = function (dir, source) {
        if (carousel.cardDeck) carousel.cardDeck.takeover();
        dir = dir < 0 ? -1 : 1;
        var previousIndex = active;
        active = (active + dir + n) % n;
        carousel.dataset.active = String(active);
        layout();
        if (typeof carousel.onProductChange === "function") carousel.onProductChange({ previousIndex: previousIndex, index: active, direction: dir, source: source || 'button' });
    };
    carousel.querySelectorAll(".carousel__arrow").forEach(function (btn) {
      btn.addEventListener("click", function () { carousel.changeProduct(parseInt(btn.dataset.dir, 10), 'button'); });
    });
    carousel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); carousel.changeProduct(1, 'keyboard'); }
      if (e.key === "ArrowLeft") { e.preventDefault(); carousel.changeProduct(-1, 'keyboard'); }
    });

    // Mobile card gestures use this same selection operation in mobile-card-deck.js.

    layout();
  }

  /* Product fits below the actual fixed navigation, including browser chrome.
     The content floor allows normal page scrolling on unusually short windows. */
  var collectionMedia = window.matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var productSection = document.getElementById('product');
  var productHeader = document.querySelector('.topbar');
  var productHeading = productSection && productSection.querySelector('.section-head');
  var productMeasureFrame = 0;
  var productDestination = function () {
    var header = productHeader.getBoundingClientRect().height;
    // Equal visible space above and below the heading, at every laptop scale.
    var lift = collectionMedia.matches
      ? Math.max(0, parseFloat(getComputedStyle(productSection).paddingTop)
        - parseFloat(getComputedStyle(productHeading).marginBottom))
      : Math.max(0, parseFloat(getComputedStyle(productSection).paddingTop) - 12);
    return Math.max(0, window.scrollY + productSection.getBoundingClientRect().top - header + lift);
  };
  // Keep the mobile heading landing independent of the section's breathing room.
  var technologyHeadingLift = function (target) {
    return target && target.classList.contains('features--mobile')
      ? Math.max(0, parseFloat(getComputedStyle(target).paddingTop) - 12) : 0;
  };
  var measureProduct = function () {
    productMeasureFrame = 0;
    if (!productSection || !collectionMedia.matches) {
      if (productSection) productSection.style.removeProperty('--product-card-height');
      return;
    }
    var header = productHeader.getBoundingClientRect().height;
    var style = getComputedStyle(productSection);
    var available = window.innerHeight - header - productHeading.getBoundingClientRect().height
      - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      - parseFloat(getComputedStyle(productHeading).marginBottom);
    // Measure real content too, so enlarged text never gets clipped.
    var scale = window.innerWidth / 1280;
    var minimum = 400 * scale;
    cards.forEach(function (card) {
      var body = card.querySelector('.card__body');
      var bodyStyle = getComputedStyle(body);
      var content = card.querySelector('.card__head').offsetHeight + card.querySelector('.specs').offsetHeight
        + parseFloat(bodyStyle.rowGap) + parseFloat(bodyStyle.paddingTop) + parseFloat(bodyStyle.paddingBottom) + 2;
      minimum = Math.max(minimum, content);
    });
    productSection.style.setProperty('--product-header', header + 'px');
    productSection.style.setProperty('--product-card-height', Math.max(minimum, Math.min(440 * scale, Math.floor(available))) + 'px');
  };
  var requestProductMeasure = function () {
    if (!productMeasureFrame) productMeasureFrame = requestAnimationFrame(measureProduct);
  };
  if (productSection) {
    window.addEventListener('resize', requestProductMeasure, { passive:true });
    collectionMedia.addEventListener('change', requestProductMeasure);
    if (document.fonts) document.fonts.ready.then(requestProductMeasure);
    if ('ResizeObserver' in window) {
      var productObserver = new ResizeObserver(requestProductMeasure);
      productObserver.observe(productHeader);
      productObserver.observe(productHeading);
      cards.forEach(function (card) {
        productObserver.observe(card.querySelector('.card__head'));
        productObserver.observe(card.querySelector('.specs'));
      });
    }
    measureProduct();
    // Wait for upstream sections and fonts before resolving the initial hash.
    var productHashInterrupted = false;
    ['wheel','touchstart','pointerdown','keydown'].forEach(function (type) {
      window.addEventListener(type, function () { productHashInterrupted = true; }, { once:true, passive:true });
    });
    var settleProductHash = function () {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        if (!['#product','#support','#technology'].includes(location.hash) || productHashInterrupted) return;
        measureProduct();
        if (window.siteScroll) window.siteScroll.cancel();
        var target = document.querySelector(location.hash);
        var box = target.id === 'technology' && target.parentElement.classList.contains('tech-stage') ? target.parentElement : target;
        var destination = location.hash === '#product' ? productDestination()
          : window.scrollY + box.getBoundingClientRect().top - productHeader.getBoundingClientRect().height
            + (location.hash === '#technology' ? technologyHeadingLift(target) : 0);
        window.scrollTo({ top:destination, behavior:'instant' });
        if (window.siteScroll) window.siteScroll.cancel();
        if (typeof requestFrame === 'function') requestFrame();
      }); });
    };
    window.addEventListener('load', function () {
      if (document.fonts) document.fonts.ready.then(settleProductHash);
      else settleProductHash();
    }, { once:true });
    window.addEventListener('hashchange', function () {
      productHashInterrupted = false;
      settleProductHash();
    });
  }

  /* ---------------- "Why us" desktop track and mobile stack ---------------- */
  var whyScroll = document.querySelector(".why__scroll-container");
  var whySticky = document.querySelector(".why__sticky");
  var track = document.querySelector(".why__track");
  var whySection = document.getElementById('why-us');
  var whyDesktop = window.matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var whyReduced = window.matchMedia('(prefers-reduced-motion:reduce)');
  var whyLayout = null;

  /* Slides translate right-to-left over their measured horizontal travel, so a
     new slide enters from the right and the old one exits to the left. That
     means a single "50% of the transition" snap is wrong for BOTH edges of
     the screen, in opposite directions: the skip button (far right) is the
     FIRST point the new slide's leading edge reaches, so a 50%-based switch
     fires far too late for it; the topbar's logo (far left) is the LAST
     point the old slide vacates, so the same 50% switch fires too early for
     it. Each needs its own trigger, timed to when the seam actually reaches
     that element's own position - not a shared, averaged guess.

     `elementsFromPoint` (plural) is used rather than `elementFromPoint`
     because sampling right at the skip button's own coordinates would just
     return the skip button itself; walking the full stack finds the actual
     slide underneath it. */
  var themeOfSlideAt = function (x, y, excludeSelector) {
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      var el = stack[i];
      if (excludeSelector && el.closest && el.closest(excludeSelector)) continue;
      var themed = el.closest ? el.closest("[data-nav-theme]") : null;
      if (themed) return themed.dataset.navTheme;
    }
    return null;
  };

  if (whySection && whyScroll && track && whySticky) {
    var whyIntro = track.querySelector('.slide--intro');
    var whyAllSlides = Array.from(track.querySelectorAll('.slide'));
    var whySlides = whyAllSlides;
    var whyViewport = whySection.querySelector('.why__viewport-probe');
    var whyStageHeight = function () {
      return whyDesktop.matches ? window.innerHeight : (whyViewport.getBoundingClientRect().height || window.innerHeight);
    };
    whySlides.forEach(function (slide, i) { slide.style.setProperty('--why-layer', i + 1); });
    var whyMeasureFrame = 0;
    var whyClamp = function (value, max) { return Math.max(0, Math.min(max, value)); };
    var updateWhyScroll = function () {
        if (!whyLayout || document.hidden) return;
        var navigating = whyScroll.dataset.skipping === 'true';
        if (navigating && !whyLayout.horizontal) {
          whyLayout.lastPaintedTop = null; whyLayout.paintedTop = null;
          return;
        }
        // Link trips hold only the sideways track. The section edge and intro
        // must keep following scroll, otherwise the heading pops in on arrival.
        if (navigating) { whyLayout.lastPaintedTop = null; whyLayout.paintedTop = null; }
        // A resize changes the prelude and Technology geometry before the next
        // measure. Keep the last painted position until that measure restores it.
        if (whyLayout.width !== whySection.clientWidth || whyLayout.height !== whyStageHeight()) {
          requestWhyMeasure();
          return;
        }
        var entranceTop = whyScroll.getBoundingClientRect().top;
        if (entranceTop === whyLayout.lastPaintedTop) return;
        whyLayout.lastTop = entranceTop;
        whyLayout.lastPaintedTop = entranceTop;
        // Paint the endpoints once even after an anchor jump, then leave the
        // offscreen deck idle until its clamped position changes again.
        var paintedTop = Math.max(-whyLayout.runway, Math.min(whyLayout.height, entranceTop));
        if (paintedTop === whyLayout.paintedTop) return;
        whyLayout.paintedTop = paintedTop;
        if (whyLayout.animated) {
          var entranceProgress = whyClamp(1 - entranceTop / whyLayout.entrance, 1);
          // Phrases rise through a fixed baseline with a soft deceleration.
          // One scroll clock preserves direct reversal and interrupted navigation.
          var reveal = whyClamp((entranceProgress - (whyLayout.stacked ? .2 : .42)) / (whyLayout.stacked ? .5 : .48), 1);
          reveal = 1 - Math.pow(1 - reveal, 3);
          whySection.style.setProperty('--why-reveal', reveal.toFixed(5));
          var brandReveal = whyClamp((entranceProgress - (whyLayout.stacked ? .28 : .48)) / (whyLayout.stacked ? .5 : .48), 1);
          brandReveal = 1 - Math.pow(1 - brandReveal, 3);
          whySection.style.setProperty('--why-brand-reveal', brandReveal.toFixed(5));
          var noteReveal = whyClamp((entranceProgress - (whyLayout.stacked ? .4 : .62)) / (whyLayout.stacked ? .44 : .38), 1);
          noteReveal = noteReveal * noteReveal * (3 - 2 * noteReveal);
          whySection.style.setProperty('--why-note-reveal', noteReveal.toFixed(5));
          whySection.classList.toggle('why--entered', entranceTop <= 1);
          if (typeof paintRecede === 'function') paintRecede(entranceProgress);
        }
        if (!whyLayout.animated) {
          if (window.siteMotion) whySlides.forEach(function (slide, i) { window.siteMotion.paintWhy(slide, i, 1, 0, false); });
          return;
        }
        if (navigating) {
          if (window.siteMotion) window.siteMotion.paintWhy(whyIntro, 0, entranceProgress, 0, true);
          // Repaint all panels when the route completes or user input interrupts.
          whyLayout.lastPaintedTop = null; whyLayout.paintedTop = null;
          return;
        }
        var scrolled = -entranceTop;
        var progress = whyClamp((scrolled - whyLayout.hold) / whyLayout.journey, 1);
        var slideProgress = progress * (whySlides.length - 1);
        var segment = Math.floor(slideProgress);
        // Panel travel stays proportional to scrolling. Ease the words and
        // details, never the track: a remapped hold/ease accelerates the panels
        // mid-segment even when the visitor scrolls at a constant speed.
        var visualProgress = slideProgress;
        if (whyLayout.horizontal) {
          var from = whyLayout.offsets[segment];
          var to = whyLayout.offsets[Math.min(segment + 1, whySlides.length - 1)];
          whyScroll.style.setProperty('--why-x', (-(from + (to - from) * (visualProgress - segment))) + 'px');
        }
        if (!whyLayout.entries) whyLayout.entries = [];
        whySlides.forEach(function (slide, i) {
          var entry = i === 0 ? 1 : whyLayout.stacked
            ? whyClamp((slideProgress - i + 1 - .15) / .85, 1) : whyClamp(visualProgress - i + 1, 1);
          if (whyLayout.entries[i] !== entry) {
            whyLayout.entries[i] = entry;
            if (whyLayout.stacked) {
              slide.style.setProperty('--why-card-y', ((1 - entry) * 100).toFixed(5) + '%');
            }
            if (i > 0) {
              // Preserve the exact warranty comparison's mobile curves.
              var content = whyClamp((entry - .48) / .44, 1);
              var detail = whyClamp((entry - .64) / .34, 1);
              slide.style.setProperty('--why-content', (1 - Math.pow(1 - content, 3)).toFixed(5));
              slide.style.setProperty('--why-detail', (1 - Math.pow(1 - detail, 3)).toFixed(5));
              var second = whyClamp((entry - .57) / .4, 1);
              var last = whyClamp((entry - .73) / .27, 1);
              slide.style.setProperty('--why-second', (1 - Math.pow(1 - second, 3)).toFixed(5));
              slide.style.setProperty('--why-last', (1 - Math.pow(1 - last, 3)).toFixed(5));
            }
          }
          var covered = whyLayout.stacked ? whyClamp((slideProgress - i - .15) / .85, 1) : whyClamp(visualProgress - i, 1);
          if (window.siteMotion) window.siteMotion.paintWhy(slide, i, i === 0 ? entranceProgress : entry, covered, true);
        });
        var currentSlide = Math.round(progress * (whySlides.length - 1));
        // Sample precisely at the skip button's own position (see
        // themeOfSlideAt above) instead of a flat 50%-of-transition snap, so
        // its border/text colour flips exactly when the slide behind IT
        // changes - not whenever the overall transition happens to cross its
        // midpoint, which is a different moment for an element sitting at
        // the far right edge of a right-to-left sliding track.
        var skipRect = skipBtn ? skipBtn.getBoundingClientRect() : null;
        var themeAtSkip = skipRect
          ? themeOfSlideAt(
              Math.round(skipRect.left + skipRect.width / 2),
              Math.round(skipRect.top + skipRect.height / 2),
              ".skip-btn"
            )
          : null;
        whySticky.setAttribute("data-theme", themeAtSkip || (currentSlide % 2 === 0 ? "dark" : "light"));
    };

    var measureWhy = function () {
      whyMeasureFrame = 0;
      if (cancelWhyFallback) cancelWhyFallback();
      var desktop = whyDesktop.matches;
      var height = whyStageHeight();
      var oldLayout = whyLayout;
      var changedViewport = oldLayout && (oldLayout.width !== whySection.clientWidth || oldLayout.height !== height);
      var oldTop = changedViewport && typeof oldLayout.lastTop === 'number' ? oldLayout.lastTop : whyScroll.getBoundingClientRect().top;
      var entering = oldLayout && oldLayout.animated && oldTop > 0 && oldTop < oldLayout.entrance;
      var inside = oldLayout && oldLayout.animated && oldTop <= 0 && -oldTop <= oldLayout.runway;
      var oldProgress = inside ? whyClamp((-oldTop - oldLayout.hold) / oldLayout.journey, 1) : 0;
      var activeSlide = inside ? whySlides[Math.round(oldProgress * (whySlides.length - 1))] : null;
      var oldSlidePosition = oldProgress * (whySlides.length - 1);
      // The hotel scene replaces the mobile hero rail; desktop keeps six scenes.
      whySlides = whyAllSlides.filter(function (slide) { return !desktop || slide.dataset.mobileOnly !== 'true'; });
      if (!desktop) {
        var focusIndex = whySlides.findIndex(function (slide) { return slide.dataset.whyScene === 'focus'; });
        var trustIndex = whySlides.findIndex(function (slide) { return slide.dataset.whyScene === 'trust'; });
        if (focusIndex >= 0 && trustIndex >= 0) {
          var focusSlide = whySlides[focusIndex];
          whySlides[focusIndex] = whySlides[trustIndex];
          whySlides[trustIndex] = focusSlide;
        }
      }
      if (activeSlide && whySlides.indexOf(activeSlide) < 0) activeSlide = whySlides[whySlides.length - 1];
      var newSlidePosition = activeSlide ? Math.max(0, Math.min(whySlides.length - 1,
        whySlides.indexOf(activeSlide) + oldSlidePosition - Math.round(oldSlidePosition))) : 0;
      // Keep reading, keyboard and cover order aligned, without cloning content.
      var orderedSlides = whySlides.concat(whyAllSlides.filter(function (slide) { return whySlides.indexOf(slide) < 0; }));
      if (orderedSlides.some(function (slide, i) { return track.children[i] !== slide; })) {
        orderedSlides.forEach(function (slide) { track.appendChild(slide); });
      }
      whySlides.forEach(function (slide, i) { slide.style.setProperty('--why-layer', i + 1); });
      whySection.style.setProperty('--why-unit', (whySection.clientWidth / 1280) + 'px');
      whySection.style.setProperty('--why-vh', (height / 100) + 'px');
      whySection.style.setProperty('--why-stage-height', height + 'px');
      // Measure intrinsic content in flow before deciding whether pinning fits.
      // Keep the current runway occupied during this synchronous measurement.
      // Removing pinning can otherwise briefly shorten the document and make
      // the browser clamp scrollY near the Collection, even if layout is unchanged.
      if (oldLayout && oldLayout.animated) whyScroll.style.setProperty('min-height', whyScroll.getBoundingClientRect().height + 'px');
      whySection.classList.remove('why--horizontal');
      whySection.classList.remove('why--stacked');
      whySlides.forEach(function (slide) {
        ['--why-card-y', '--why-content', '--why-detail', '--why-second', '--why-last'].forEach(function (key) { slide.style.removeProperty(key); });
      });
      whyScroll.style.removeProperty('--why-x');
      var bar = document.querySelector('.topbar');
      var clearance = Math.max(72, bar ? bar.getBoundingClientRect().height + 24 : 72);
      var fits = whySlides.every(function (slide) {
        var inner = slide.querySelector('.slide__inner');
        return inner.scrollHeight + clearance * 2 <= height
          && inner.scrollWidth <= whySection.clientWidth - (desktop ? 48 : 40);
      });
      var animated = !whyReduced.matches && height > 520 && fits;
      var horizontal = desktop && animated;
      var stacked = !desktop && animated;
      whySection.classList.toggle('why--horizontal', horizontal);
      whySection.classList.toggle('why--stacked', stacked);
      var firstLeft = whySlides[0].getBoundingClientRect().left;
      var offsets = whySlides.map(function (slide, i) { return stacked ? i * height : slide.getBoundingClientRect().left - firstLeft; });
      var travel = animated ? offsets[offsets.length - 1] : 0;
      var hold = desktop ? height * .2 : 0;
      var journey = height * (desktop ? 1.6 : 1) * (whySlides.length - 1);
      var runway = journey + hold * 2;
      var entrance = height;
      whyLayout = { animated: animated, horizontal: horizontal, stacked: stacked, travel: travel, hold: hold, journey: journey, runway: runway, offsets: offsets, entrance: entrance, prelude: 0, width: whySection.clientWidth, height: height };
      whyScroll.style.setProperty('--why-height', (height + runway) + 'px');
      whyScroll.style.removeProperty('min-height');
      if (!animated) {
        whySection.style.removeProperty('--why-reveal');
        whySection.style.removeProperty('--why-note-reveal');
        whySection.style.removeProperty('--why-brand-reveal');
      }
      track.tabIndex = animated ? 0 : -1;
      if (animated) track.setAttribute('aria-roledescription', 'carousel');
      else track.removeAttribute('aria-roledescription');
      // Preserve entrance progress or the current card, including axis changes.
      var layoutChanged = oldLayout && (oldLayout.animated !== animated || oldLayout.horizontal !== horizontal || oldLayout.width !== whyLayout.width || oldLayout.height !== height);
      if ((inside || entering) && layoutChanged && whyScroll.dataset.skipping !== 'true') {
        if (window.siteScroll) window.siteScroll.cancel();
        var position = entering ? -oldTop / oldLayout.entrance * entrance
          : oldLayout.horizontal === horizontal ? (-oldTop / oldLayout.runway) * runway
          : hold + newSlidePosition * journey / (whySlides.length - 1);
        var destination = animated
          ? window.scrollY + whyScroll.getBoundingClientRect().top + position
          : window.scrollY + (activeSlide || whyIntro).getBoundingClientRect().top;
        window.scrollTo({ top: destination, behavior: 'instant' });
      }
      if (typeof syncTechStage === 'function') syncTechStage();
      updateWhyScroll();
      if (typeof requestFrame === 'function') requestFrame();
    };
    var requestWhyMeasure = function () {
      if (!whyMeasureFrame) whyMeasureFrame = window.requestAnimationFrame(measureWhy);
    };
    whyDesktop.addEventListener('change', requestWhyMeasure);
    whyReduced.addEventListener('change', requestWhyMeasure);
    window.addEventListener('resize', function () {
      // svh is stable while mobile browser chrome opens/closes. Ignore those
      // resize events instead of cancelling a gesture or moving the deck.
      if (!whyLayout || whyLayout.width !== whySection.clientWidth || whyLayout.height !== whyStageHeight()) requestWhyMeasure();
    }, { passive: true });
    if (document.fonts) document.fonts.ready.then(requestWhyMeasure);
    if ('ResizeObserver' in window) {
      var whyObserver = new ResizeObserver(requestWhyMeasure);
      whyAllSlides.forEach(function (slide) { whyObserver.observe(slide.querySelector('.slide__inner')); });
    }
    measureWhy();

    // Direct Why links land on the settled introduction on either axis.
    window.addEventListener('load', function () {
      var settleWhyHash = function () {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (window.location.hash !== '#why-us' || !whyLayout.animated) return;
            if (window.siteScroll) window.siteScroll.cancel();
            window.scrollTo({ top: Math.ceil(window.scrollY + whyScroll.getBoundingClientRect().top), behavior: 'instant' });
            if (window.siteScroll) window.siteScroll.cancel();
            updateWhyScroll();
          });
        });
      };
      if (document.fonts) document.fonts.ready.then(settleWhyHash);
      else settleWhyHash();
    }, { once: true });

    // Scaled laptop windows can use this presentation without Lenis. Keep
    // their anchor/Skip journeys just as interruptible as the desktop controller.
    var cancelWhyFallback = null;
    var navigateWhy = function (target, done, options) {
      if (cancelWhyFallback) cancelWhyFallback();
      if (window.siteScroll && window.siteScroll.to(target, done, options)) return true;
      if (whyReduced.matches) {
        window.scrollTo({ top: target, behavior: 'instant' });
        if (done) done();
        return true;
      }
      var start = window.scrollY, started = null, navigationFrame = 0;
      var cut = options && options.cut;
      var low = cut ? Math.max(Math.min(start, target), cut[0]) : 0;
      var high = cut ? Math.min(Math.max(start, target), cut[1]) : 0;
      var skipped = Math.max(0, high - low);
      var distance = Math.abs(target - start) - skipped;
      var direction = target >= start ? 1 : -1;
      var before = direction > 0 ? low - start : start - high;
      var laptop = whyLayout && whyLayout.horizontal;
      var duration = laptop ? Math.min(1500, 600 + 250 * Math.sqrt(distance / Math.max(1, window.innerHeight))) : 600;

      var finish = function () {
        window.cancelAnimationFrame(navigationFrame);
        cancelWhyFallback = null;
        if (done) done();
        if (typeof requestFrame === 'function') requestFrame();
      };
      cancelWhyFallback = finish;
      var step = function (time) {
        if (started === null) started = time;
        var p = Math.min(1, (time - started) / duration);
        var eased = laptop ? p * p * p * (p * (p * 6 - 15) + 10)
          : p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        var travelled = distance * eased;
        var position = start + direction * (travelled + (skipped && travelled >= before ? skipped : 0));
        window.scrollTo({ top: p === 1 ? target : position, behavior: 'instant' });
        if (p < 1) navigationFrame = window.requestAnimationFrame(step);
        else finish();
      };
      navigationFrame = window.requestAnimationFrame(step);
      return true;
    };
    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (type) {
      window.addEventListener(type, function () { if (cancelWhyFallback) cancelWhyFallback(); }, { capture: true, passive: true });
    });
    
    var skipBtn = document.getElementById("skip-why");
    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        var nextSection = document.getElementById("product");
        if (nextSection) {
          if (cancelWhyFallback) cancelWhyFallback();
          if (window.siteScroll) window.siteScroll.cancel();
          whyScroll.dataset.skipping = "true";
          
          var targetY = productDestination();
          var pinnedStart = window.scrollY + whyScroll.getBoundingClientRect().top;
          navigateWhy(targetY, function () {
            whyScroll.dataset.skipping = 'false';
            updateWhyScroll();
            if (typeof requestFrame === 'function') requestFrame();
          }, whyLayout.horizontal ? { cut:[pinnedStart + 1, pinnedStart + whyLayout.runway - 1] } : undefined);
        }
      });
    }

    track.addEventListener("keydown", function (e) {
      if (!whyLayout || !whyLayout.animated || e.altKey || e.ctrlKey || e.metaKey) return;
      var nextKey = whyLayout.stacked ? 'ArrowDown' : 'ArrowRight';
      var previousKey = whyLayout.stacked ? 'ArrowUp' : 'ArrowLeft';
      if (e.key === nextKey || e.key === previousKey) {
        e.preventDefault();
        var progress = whyClamp((-whyScroll.getBoundingClientRect().top - whyLayout.hold) / whyLayout.journey, 1);
        var current = progress * (whySlides.length - 1);
        var index = e.key === nextKey ? Math.floor(current + .001) + 1 : Math.ceil(current - .001) - 1;
        index = whyClamp(index, whySlides.length - 1);
        var target = window.scrollY + whyScroll.getBoundingClientRect().top + whyLayout.hold
          + whyLayout.offsets[index] / whyLayout.travel * whyLayout.journey;
        navigateWhy(target);
      }
    });
  }

  /* ---------------- Nav: highlight the section in view ---------------- */
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__item"));
  if (navItems.length && "IntersectionObserver" in window) {
    var sectionIds = navItems.map(function (a) { return a.dataset.section; });
    var visible = {}, techIntersecting = false;
    var setActiveNav = function (id) {
      // The hero's scroll runway sits underneath Technology. Count the
      // visible white surface, rather than that hidden overlapping box.
      if (clarityEnabled && tech) {
        var boundary = techBounds();
        if (boundary.top > window.innerHeight * .5) id = 'home';
        else if (boundary.bottom > window.innerHeight * .5) id = 'technology';
      }
      navItems.forEach(function (a) { a.classList.toggle("nav__item--active", a.dataset.section === id); });
    };
    // Create an array of thresholds from 0 to 1 with 0.05 increments
    var thresholds = [];
    for (var i = 0; i <= 20; i++) thresholds.push(i / 20);
    
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible[en.target.id] = en.isIntersecting ? en.intersectionRect.height : 0;
        if (en.target === tech) techIntersecting = en.isIntersecting;
      });
      // A pinned Technology stays in view while covered; count its flow position.
      if (techReceding && techIntersecting) {
        var flow = techBounds(), h = window.innerHeight;
        visible.technology = Math.max(0, Math.min(flow.bottom, h * .7) - Math.max(flow.top, h * .1));
      }
      var best = null, bestVal = 0;
      sectionIds.forEach(function (id) { if (visible[id] > bestVal) { best = id; bestVal = visible[id]; } });
      if (best) setActiveNav(best);
    }, { threshold: thresholds, rootMargin: "-10% 0px -30% 0px" });
    sectionIds.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });

    // Section navigation shares one clock with the desktop scroll controller.
    document.querySelectorAll('a[href^="#"]').forEach(function(item) {
      item.addEventListener("click", function(e) {
        var targetId = this.getAttribute("href");
        if (targetId === "#") return;
        var target = document.querySelector(targetId);
        if (!target) return;
        
        e.preventDefault();

        // Release an earlier click before holding the track for this journey.
        if (cancelWhyFallback) cancelWhyFallback();
        if (window.siteScroll) window.siteScroll.cancel();
        
        // Freeze the 'why us' track so it doesn't fast-forward
        var whyScroll = document.querySelector(".why__scroll-container");
        if (whyScroll) whyScroll.dataset.skipping = "true";
        
        var headerHeight = document.querySelector('.topbar').getBoundingClientRect().height;
        var headerOffset = ['#product','#support','#technology'].includes(targetId) ? headerHeight
          : !isDesktop() && targetId !== "#home" ? headerHeight + 12 : 0;
        var targetBox = target === tech && techStage ? techStage : target;
        var targetY = targetId === '#product' ? productDestination()
          : Math.max(0, targetBox.getBoundingClientRect().top + window.scrollY - headerOffset
            + (targetId === '#technology' ? technologyHeadingLift(target) : 0));
        if (targetId === '#why-us' && whyLayout && whyLayout.animated) {
          targetY = window.scrollY + whyScroll.getBoundingClientRect().top;
        }
        var navigationOptions;
        if (whyScroll && whyLayout && whyLayout.horizontal) {
          var pinnedStart = window.scrollY + whyScroll.getBoundingClientRect().top;
          navigationOptions = { cut:[pinnedStart + 1, pinnedStart + whyLayout.runway - 1] };
          if (targetY <= pinnedStart + 1) {
            var whyRect = whyScroll.getBoundingClientRect();
            if (whyRect.top >= window.innerHeight || whyRect.bottom <= headerHeight + 2) {
              // Every upward crossing must carry the introduction through the
              // dark-to-light entrance, not the last (white) card. Otherwise
              // Technology's visible lower edge snaps when the hold is released.
              whyScroll.style.setProperty('--why-x', '0px');
              if (window.siteMotion) window.siteMotion.paintWhy(whyIntro, 0, 1, 0, true);
            } else if (targetId === '#why-us') {
              whyScroll.dataset.skipping = 'false';
              navigationOptions = undefined;
            }
          }
        }
        var navigate = typeof navigateWhy === 'function' ? navigateWhy : window.siteScroll && window.siteScroll.to;
        if (navigate && navigate(targetY, function () {
          if (whyScroll) {
            whyScroll.dataset.skipping = 'false';
            window.dispatchEvent(new Event('scroll'));
          }
          if (typeof requestFrame === 'function') requestFrame();
        }, navigationOptions)) return;
        var startY = window.scrollY;
        var difference = targetY - startY;
        var startTime = null;
        var duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600;
        
        function step(time) {
          if (startTime === null) startTime = time;
          var progress = duration ? Math.min((time - startTime) / duration, 1) : 1;
          // easeInOutCubic
          var ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
          window.scrollTo(0, startY + difference * ease);
          
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            // Unfreeze when done
            if (whyScroll) {
              whyScroll.dataset.skipping = "false";
              window.dispatchEvent(new Event('scroll'));
            }
            // Belt-and-suspenders: explicitly force the topbar to re-sample
            // its resting surface (mode/theme/logo colour) right here, rather
            // than relying solely on the synthetic "scroll" event above
            // having been fully processed. This is the exact jump this bar
            // fix targets - clicking a nav link (e.g. "Product") from the
            // very top of the page lands far down the document in one 600ms
            // hop, and the topbar should reflect exactly where it landed
            // without requiring the user to scroll again first.
            if (typeof requestFrame === "function") requestFrame();
          }
        }
        requestAnimationFrame(step);
      });
    });
  }

  /* ---------------- Scroll-driven effects ----------------
     One scroll listener and one rAF per frame, with every measurement taken
     before any style is written. Previously the hero transition, the
     Technology reveal and the nav hide each registered
     their own unthrottled listener, and each interleaved getBoundingClientRect
     with style writes — so a single scroll event forced layout several times
     over. Visual output is unchanged; only the scheduling differs. */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var hero = document.getElementById("home");
  // One font-ready mobile narrative. The outer hero remains owned by the
  // reversible cloud transition; only its children take part in this entrance.
  var phoneTitleRoot = document.documentElement;
  var phoneTitleMedia = window.matchMedia("(width < 600px), (width < 1100px) and (aspect-ratio < 4/3), (width < 1100px) and (hover: none), (width < 1100px) and (pointer: coarse), (width < 1100px) and (pointer: none)");
  var heroEntranceTimer = 0;
  var showStaticTitle = function () {
    phoneTitleRoot.dataset.phoneTitle = "static";
    window.clearTimeout(heroEntranceTimer);
    if (hero) hero.classList.add("hero--entered");
  };
  if (phoneTitleRoot.dataset.phoneTitle === "pending") {
    if (document.fonts && !reduceMotion.matches && !document.hidden && window.scrollY < 24 && (!window.location.hash || window.location.hash === '#home')) {
      Promise.all([
        document.fonts.load('72px "Anton"', 'TOILETS'),
        document.fonts.load('80px "Billion Dreams"', 'Redefined')
      ]).then(function (faces) {
        if (phoneTitleRoot.dataset.phoneTitle !== "pending") return;
        if (!faces.every(function (list) { return list.length > 0; }) || !phoneTitleMedia.matches || reduceMotion.matches || document.hidden) { showStaticTitle(); return; }
        phoneTitleRoot.dataset.phoneTitle = "reveal";
        heroEntranceTimer = window.setTimeout(showStaticTitle, 1600);
      }, showStaticTitle);
    } else showStaticTitle();
  }
  phoneTitleMedia.addEventListener("change", showStaticTitle);
  reduceMotion.addEventListener("change", function (event) { if (event.matches) showStaticTitle(); });
  // Input always wins over loading; no hidden CTA waits for an animation.
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (type) {
    window.addEventListener(type, showStaticTitle, {once:true, passive:true});
  });
  window.addEventListener('scroll', function () {
    if (phoneTitleRoot.dataset.phoneTitle !== 'static' && window.scrollY > 24) showStaticTitle();
  }, {passive:true});
  window.addEventListener('pageshow', function (event) { if (event.persisted) showStaticTitle(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) showStaticTitle(); });
  var tech = document.getElementById("technology");
  var topbar = document.querySelector(".topbar");
  // Technology can pin while Why us rises over it. Its stage keeps the flow
  // geometry, so the hero handoff and navigation read the original boundary.
  var techStage = tech && tech.parentElement.classList.contains('tech-stage') ? tech.parentElement : null;
  var techHeight = 0, techReceding = false, techRecede = 0, techStableHeight = 0;
  var techBounds = function () {
    var r = (techStage || tech).getBoundingClientRect();
    return { top: r.top, bottom: r.top + (techStage ? techHeight || tech.offsetHeight : r.height) };
  };
  var syncTechStage = function () {
    if (!techStage) return;
    techHeight = tech.offsetHeight;
    techStableHeight = clarityMobileViewport || window.innerHeight;
    var enable = clarityEnabled && !reduceMotion.matches && !!whyLayout && whyLayout.animated;
    if (enable !== techReceding) {
      techReceding = enable;
      techStage.classList.toggle('is-receding', enable);
      if (!enable) {
        techRecede = 0;
        tech.style.transform = '';
        tech.style.removeProperty('--tech-veil');
        if (whySection) whySection.style.clipPath = '';
      }
      if (whyLayout) { whyLayout.lastPaintedTop = null; whyLayout.paintedTop = null; }
    }
    if (!enable) return;
    // Pin by the lower edge, holding until Why us has covered the screen.
    // Shared by the stage and the following Why section, so set on their parent.
    var runway = Math.min(techHeight, techStableHeight), scope = techStage.parentElement.style;
    scope.setProperty('--tech-runway', runway + 'px');
    scope.setProperty('--tech-pin', Math.min(0, techStableHeight - techHeight) + 'px');
    scope.setProperty('--tech-origin', (Math.max(0, techHeight - techStableHeight) + runway / 2) + 'px');
  };
  // Driven by Why's own entrance clock: Technology steps back into darkness
  // while the incoming panel opens from an inset slab to the full width.
  var paintRecede = function (progress) {
    if (!techReceding) return;
    var r = Math.max(0, Math.min(1, progress));
    var e = r * r * (3 - 2 * r);
    techRecede = e;
    tech.style.transform = e > 0
      ? 'translate3d(0,' + (-.035 * techStableHeight * e).toFixed(3) + 'px,0) scale(' + (1 - .06 * e).toFixed(5) + ')' : '';
    tech.style.setProperty('--tech-veil', (.8 * e).toFixed(5));
    var slab = 1 - e;
    whySection.style.clipPath = slab > .0005
      ? 'inset(0 ' + (4 * slab).toFixed(3) + '% 0 round ' + (32 * slab).toFixed(2) + 'px ' + (32 * slab).toFixed(2) + 'px 0 0)' : '';
  };

  var bodyScrolled = false;
  var frame = 0;
  var clarityEnabled = false;
  var lastClarity = null;
  var clarityMobileViewport = 0;
  var clarityScene = hero && hero.querySelector('.hero__sticky');
  var measureClarity = function () {
    clarityEnabled = !!hero && getComputedStyle(hero).getPropertyValue('--clarity-enabled').trim() === '1';
    if (clarityEnabled && !isDesktop() && clarityScene) {
      // The computed minimum is 100svh. Mobile browser chrome may change
      // innerHeight during a swipe; a stable viewport keeps the grade continuous.
      clarityMobileViewport = parseFloat(getComputedStyle(clarityScene).minHeight) || window.innerHeight;
      hero.style.setProperty('--clarity-scene-height', clarityScene.getBoundingClientRect().height + 'px');
    } else {
      clarityMobileViewport = 0;
      if (hero) hero.style.removeProperty('--clarity-scene-height');
    }
    syncTechStage();
  };
  var smoothRange = function (start, end, value) {
    var p = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return p * p * (3 - 2 * p);
  };

  /* Bottom edge of the fixed chrome. Used to tell whether the bar is sitting
     over the hero's flat sky (nothing behind it worth a glass treatment) or
     over real content (the fog's texture rising in, or the page beyond it) -
     drives the shared topbar's merge/glass toggle below. Re-measured on
     resize and when enlarged text changes the header's height. */
  var chromeBottom = 110;
  var measureChrome = function () {
    var el = topbar;
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.height) {
        chromeBottom = r.top + r.height;
        if (!isDesktop()) document.documentElement.style.setProperty('--mobile-header-height', r.height + 'px');
        else document.documentElement.style.removeProperty('--mobile-header-height');
      }
    }
  };
  // Reflowing text and device safe areas can make the mobile header taller.
  if (topbar && 'ResizeObserver' in window) new ResizeObserver(measureChrome).observe(topbar);

  /* The cloud boundary controls navigation contrast during the
     handoff. Below the hero, sample the real section beneath the topbar. */
  // HTML supplies Home's merge/dark surface before first paint, preventing a
  // black-to-white logo flash. Leave the runtime cache unset so the first
  // measurement still handles restored scroll positions and direct section links.
  var topbarMode = null;
  var topbarTheme = null;
  var hasTopbarContent = function () {
    var rect = topbar.getBoundingClientRect();
    // Inspect the foremost page element, never content hidden behind a solid
    // section. Sampling inside the bar catches content before it exits below.
    return [.08, .24, .4, .56, .72, .88, .96].some(function (fraction) {
      return [.25, .75].some(function (row) {
        var stack = document.elementsFromPoint(rect.left + rect.width * fraction, rect.top + rect.height * row);
        var el = stack.find(function (node) { return !node.closest('.topbar, .mobile-menu, .skip-link'); });
        if (!el || el.closest('.hero__bg, .hero__mist-behind, .hero__clouds, .hero__fog-overlay')) return false;
        return !!el.closest('h1, h2, h3, h4, p, button, a, li, figure, picture, img, video, canvas, svg, .features__media, .feature__btn, .stats, .pills');
      });
    });
  };
  var applyTopbarSurface = function (mode, theme, perControl) {
    if (!topbar) return;
    if (isDesktop() && mode === 'merge' && hasTopbarContent()) mode = 'glass';
    if (!isDesktop() && menu && !menu.hidden) { mode = "glass"; theme = "dark"; perControl = false; }
    // A shared surface must release individual Why-slide colours, including
    // direct returns to Home that bypass the below-hero sampler. Do this even
    // when the cached shared theme has not changed.
    if (!perControl && whyNavInk) whyNavInk.forEach(function (control) {
      if (control.dataset.whySurface) delete control.dataset.whySurface;
    });
    if (mode !== topbarMode) {
      topbarMode = mode;
      topbar.setAttribute("data-mode", mode);
    }
    if (theme !== topbarTheme) {
      topbarTheme = theme;
      topbar.setAttribute("data-theme", theme);
    }
  };

  var parseRgb = function (color) {
    var m = color && color.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var parts = m[1].split(",").map(function (v) {
      return parseFloat(v);
    });
    var r = parts[0],
      g = parts[1],
      b = parts[2];
    var a = parts.length > 3 ? parts[3] : 1;
    if ([r, g, b, a].some(isNaN)) return null;
    if (a <= 0.05) return null; // transparent - keep walking up
    return { r: r, g: g, b: b };
  };
  var getLuminance = function (c) {
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  };
  var inferBackgroundTheme = function (el) {
    var cur = el;
    while (cur && cur !== document.documentElement) {
      var bg = parseRgb(getComputedStyle(cur).backgroundColor);
      if (bg) return getLuminance(bg) > 0.58 ? "light" : "dark";
      cur = cur.parentElement;
    }
    var bodyBg = parseRgb(getComputedStyle(document.body).backgroundColor);
    return bodyBg && getLuminance(bodyBg) > 0.58 ? "light" : "dark";
  };
  var topbarLogo = document.querySelector(".topbar__logo");
  var whyNavInk = topbar ? Array.from(topbar.querySelectorAll('.nav__item, .topbar__contact, .hamburger')) : [];

  var sampleBelowHeroSurface = function () {
    if (!topbar) return;

    /* Two contrasting slides can share the screen. Sample the logo and each
       control independently as the boundary passes beneath the fixed bar. */
    if (whyScroll) {
      var whyRect = whyScroll.getBoundingClientRect();
      if (whyLayout && whyLayout.animated && whyRect.top < topbar.getBoundingClientRect().bottom && whyRect.bottom >= whyLayout.height && !(menu && !menu.hidden)) {
        var barRect = topbar.getBoundingClientRect();
        var logoRect = topbarLogo ? topbarLogo.getBoundingClientRect() : null;
        var lx = logoRect ? Math.round(logoRect.left + logoRect.width / 2) : Math.round(barRect.left + 60);
        var ly = logoRect ? logoRect.top + logoRect.height / 2 : barRect.top + barRect.height / 2;
        var themeAtLogo = ly < whyRect.top ? 'light' : themeOfSlideAt(lx, ly, '.topbar');
        applyTopbarSurface("merge", themeAtLogo || (whySticky ? whySticky.dataset.theme : "dark") || "dark", true);
        // A seam can sit between the logo and links. Each control follows the
        // surface directly beneath it rather than waiting for the far-left logo.
        whyNavInk.forEach(function (control) {
          var rect = control.getBoundingClientRect();
          if (!rect.width) return;
          var sampleY = rect.top + rect.height / 2;
          var theme = sampleY < whyRect.top ? 'light' : themeOfSlideAt(rect.left + rect.width / 2, sampleY, '.topbar');
          if (theme && control.dataset.whySurface !== theme) control.dataset.whySurface = theme;
        });
        return;
      }
    }
    var r = topbar.getBoundingClientRect();
    var probeX = Math.round(window.innerWidth / 2);
    var probeY = Math.round(r.bottom + 8); // just past the bar's own pixels
    var el = document.elementFromPoint(probeX, probeY);
    var modeEl = el && el.closest ? el.closest("[data-nav-mode]") : null;
    var mode = modeEl ? modeEl.dataset.navMode : "glass";
    var themeEl = el && el.closest ? el.closest("[data-nav-theme]") : null;
    var theme = themeEl ? themeEl.dataset.navTheme : inferBackgroundTheme(el);
    // The receding Technology panel darkens beneath the bar before Why arrives.
    if (typeof techRecede === 'number' && techRecede > .42 && el && tech.contains(el)) theme = 'dark';
    applyTopbarSurface(mode, theme);
  };

  var onFrame = function () {
    frame = 0;
    if (document.hidden) return;

    // Read stationary scene geometry before any scroll-driven styles change.
    var sceneFrame = window.siteMotion ? window.siteMotion.read(window.scrollY, window.innerHeight) : null;
    if (typeof updateWhyScroll === 'function') updateWhyScroll();

    var vh = window.innerHeight;
    var scrollY = window.scrollY;
    var still = reduceMotion.matches;

    /* ---- reads ---- */
    var heroRect = hero ? hero.getBoundingClientRect() : null;
    var techRect = tech && !still ? techBounds() : null;

    /* ---- writes ---- */
    if (heroRect) {
      if (clarityEnabled && techRect) {
        // A single physical boundary drives atmosphere, content and navigation.
        // Lighting follows the real scroll position, including Lenis's frames.
        var clarityVh = clarityMobileViewport || vh;
        var p = Math.max(0, Math.min(1, 1 - techRect.top / clarityVh));
        if (typeof setActiveNav === 'function' && techRect.bottom > vh * .5) {
          setActiveNav(p < .5 ? 'home' : 'technology');
        }
        if (p !== lastClarity) {
          hero.style.setProperty('--clarity-p', p.toFixed(5));
          // Colour and exposure only decrease on the outgoing scene. The
          // incoming paper gains light independently; neither curve rebounds.
          var mono = smoothRange(0, .56, p);
          var contrast = 1 + .50 * smoothRange(.08, .65, p);
          hero.style.setProperty('--clarity-grade', p === 0 ? 'none'
            : 'grayscale(' + mono.toFixed(5) + ') contrast(' + contrast.toFixed(5) + ')');
          hero.style.setProperty('--clarity-sky', (1 - .90 * smoothRange(.02, .78, p)).toFixed(5));
          hero.style.setProperty('--clarity-presence', (1 - .78 * smoothRange(.12, .76, p)).toFixed(5));
          tech.style.setProperty('--clarity-paper', (234 + 21 * smoothRange(0, .72, p)).toFixed(3));
          tech.style.setProperty('--clarity-p', p.toFixed(5));
          tech.style.setProperty('--clarity-title', smoothRange(.08, .42, p).toFixed(5));
          tech.style.setProperty('--clarity-detail', smoothRange(.14, .48, p).toFixed(5));
          lastClarity = p;
        }
        // The veil is brightest at its base. Switch ink while it is still
        // approaching the bar, with hysteresis to avoid threshold flicker.
        var cloudDepth = clarityVh * (.12 + .18 * p);
        var surfaceAtBar = (chromeBottom * .5 - techRect.top + cloudDepth) / cloudDepth;
        var lightInk = topbarTheme === 'light'
          ? surfaceAtBar > .50
          : surfaceAtBar > .58;
        var glass = techRect.top <= 0;
        if (glass !== bodyScrolled) {
          bodyScrolled = glass;
          document.body.classList.toggle('is-scrolled', glass);
        }
        if (techRect.top <= 0) sampleBelowHeroSurface();
        else applyTopbarSurface(isDesktop() && techRect.top - cloudDepth < chromeBottom ? 'glass' : 'merge', lightInk ? 'light' : 'dark');
      } else {
        // Short viewports and reduced motion retain the normal-flow handoff.
        lastClarity = null;
        hero.style.removeProperty('--clarity-p');
        hero.style.removeProperty('--clarity-grade');
        hero.style.removeProperty('--clarity-sky');
        hero.style.removeProperty('--clarity-presence');
        if (tech) {
          tech.style.removeProperty('--clarity-p');
          tech.style.removeProperty('--clarity-paper');
          tech.style.removeProperty('--clarity-title');
          tech.style.removeProperty('--clarity-detail');
        }
        var glass = !isDesktop() ? (bodyScrolled ? scrollY > 8 : scrollY > 24) : heroRect.bottom < chromeBottom;
        if (glass !== bodyScrolled) {
          bodyScrolled = glass;
          document.body.classList.toggle('is-scrolled', glass);
        }
        if (heroRect.bottom <= chromeBottom) sampleBelowHeroSurface();
        else applyTopbarSurface(glass ? 'glass' : 'merge', 'dark');
        if (techRect) {
          var techP = 1 - Math.max(0, Math.min(1, (techRect.top - (vh - 300)) / 300));
          tech.style.setProperty('--tech-scroll-p', techP);
        }
      }
    }

    if (window.siteMotion) window.siteMotion.render(sceneFrame);
  };

  var requestFrame = function () {
    if (!document.hidden && !frame) frame = window.requestAnimationFrame(onFrame);
  };

  if (window.siteScroll) window.siteScroll.onFrame(function () {
    // Paint the lighting on the same frame as the smoothed page position.
    if (frame) window.cancelAnimationFrame(frame);
    onFrame();
  });
  if (window.siteScroll) {
    window.siteScroll.requestFrame = requestFrame;
    window.siteScroll.refreshWhy = function () {
      if (whyLayout) { whyLayout.lastPaintedTop = null; whyLayout.paintedTop = null; }
      if (typeof updateWhyScroll === 'function') updateWhyScroll();
    };
  }

  // Mobile feature expansion and decoded photos move the following boundary
  // even when the page itself has stopped scrolling. Repaint that boundary too.
  if (tech && 'ResizeObserver' in window) new ResizeObserver(function () { syncTechStage(); requestFrame(); }).observe(tech);
  window.addEventListener("scroll", requestFrame, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { window.cancelAnimationFrame(frame); frame = 0; }
    else requestFrame();
  });
  window.addEventListener(
    "resize",
    function () {
      measureChrome();
      measureClarity();
      lastClarity = null;
      requestFrame();
    },
    { passive: true }
  );
  reduceMotion.addEventListener('change', function () {
    measureClarity();
    lastClarity = null;
    requestFrame();
  });
  // Fonts, text size and phone rotation can change the intrinsic scene height.
  if (clarityScene && 'ResizeObserver' in window) new ResizeObserver(function () {
    measureClarity();
    requestFrame();
  }).observe(clarityScene);
  measureChrome();
  measureClarity();
  requestFrame();
})();


  // Mobile Why Us Skip functionality
  var mobileSkipBtns = document.querySelectorAll(".skip-btn-mobile");
  mobileSkipBtns.forEach(function(btn) {
    btn.addEventListener("click", function() {
      var nextSection = document.getElementById("product");
      if (nextSection) {
        var targetY = nextSection.getBoundingClientRect().top + window.scrollY
          - document.querySelector('.topbar').getBoundingClientRect().height - 12;
        var startY = window.scrollY;
        var difference = targetY - startY;
        var startTime = null;
        function step(time) {
          if (startTime === null) startTime = time;
          var progress = Math.min((time - startTime) / 600, 1);
          var ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          window.scrollTo(0, startY + difference * ease);
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        }
        window.requestAnimationFrame(step);
      }
    });
  });
