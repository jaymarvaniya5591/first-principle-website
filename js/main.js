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

  /* ---------------- Collection carousel (6 products, 3 visible on desktop) ---------------- */
  var carousel = document.querySelector(".carousel");
  if (carousel) {
    var cards = Array.prototype.slice.call(carousel.querySelectorAll(".card"));
    var status = document.getElementById("carousel-status");
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
      });
      // Eager-load the neighbours so the next click is instant.
      cards.forEach(function (card) {
        if (card.dataset.pos) card.querySelectorAll("img[loading=lazy]").forEach(function (img) { img.loading = "eager"; });
      });
      if (status) {
        var name = cards[active].querySelector("h3");
        status.textContent = "Showing " + (name ? name.textContent : "") + ", " + (active + 1) + " of " + n;
      }
    };

    carousel.querySelectorAll(".carousel__arrow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = parseInt(btn.dataset.dir, 10) || 1;
        active = (active + dir + n) % n;
        carousel.dataset.active = String(active);
        layout();
      });
    });
    carousel.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); carousel.querySelector(".carousel__arrow--next").click(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); carousel.querySelector(".carousel__arrow--prev").click(); }
    });

    // Touch swipe on mobile
    var startX = null;
    carousel.addEventListener("touchstart", function (e) { startX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) < 50) return;
      carousel.querySelector(dx < 0 ? ".carousel__arrow--next" : ".carousel__arrow--prev").click();
    }, { passive: true });

    layout();
  }

  /* ---------------- "Why us" horizontal scroll ---------------- */
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
    var originalSlides = Array.from(track.querySelectorAll('.slide:not(.slide--intro)'));
    var originalThemes = originalSlides.map(function (slide) { return slide.dataset.navTheme; });
    var desktopSlides = [whyIntro].concat(originalSlides.slice(1), originalSlides.slice(0, 1));
    var whyOrderDesktop = false;
    var whyMeasureFrame = 0;
    var whyLightShift = 0;
    var whyClamp = function (value, max) { return Math.max(0, Math.min(max, value)); };
    // Sample actual neutral Oklab lightness, then encode sRGB colours once.
    // A full colour surface preserves the grey range over both section backgrounds.
    var whyToneSamples = Array.from({ length: 65 }, function (_, i) {
      if (i === 0) return 0;
      if (i === 64) return 1;
      var t = i / 64, eased = t * t * (3 - 2 * t);
      var blackLinear = Math.pow((17 / 255 + .055) / 1.055, 2.4);
      var lightness = 1 + (Math.cbrt(blackLinear) - 1) * eased;
      var linear = lightness * lightness * lightness;
      var grey = 255 * (linear <= .0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - .055);
      return whyClamp((255 - grey) / 238, 1);
    });
    var whyToneDarkness = function (vertical) {
      var sample = whyClamp((vertical - .08) / .58, 1) * 64;
      var lower = Math.floor(sample), upper = Math.min(64, lower + 1);
      return whyToneSamples[lower] + (whyToneSamples[upper] - whyToneSamples[lower]) * (sample - lower);
    };
    whySection.style.setProperty('--why-tone-stops', whyToneSamples.map(function (darkness, i) {
      var grey = (255 - darkness * 238).toFixed(4);
      return 'rgb(' + grey + ',' + grey + ',' + grey + ') ' + (8 + i * 58 / 64) + 'vh';
    }).join(','));
    whySection.style.setProperty('--why-grain-stops', whyToneSamples.map(function (darkness, i) {
      return 'rgba(0,0,0,' + (4 * darkness * (1 - darkness)).toFixed(6) + ') ' + (8 + i * 58 / 64) + 'vh';
    }).join(','));

    var updateWhyScroll = function () {
        if (!whyLayout) return;
        // A resize changes the prelude and Technology geometry before the next
        // measure. Keep the last painted position until that measure restores it.
        if (whyLayout.width !== whySection.clientWidth || whyLayout.height !== window.innerHeight) {
          requestWhyMeasure();
          return;
        }
        whyLayout.lastTop = whyScroll.getBoundingClientRect().top;
        if (whyLayout.horizontal) {
          // A 12vh prelude plus 88vh overlap makes a one-viewport entrance.
          var entranceTop = whyScroll.getBoundingClientRect().top;
          var entranceProgress = whyClamp(1 - entranceTop / whyLayout.entrance, 1);
          // Retreat the whole tonal surface, leaving a fully black viewport at
          // pinning. No fades to black, competing overlays or independent clock.
          var retreat = entranceProgress * entranceProgress * (3 - 2 * entranceProgress);
          whyLightShift = -window.innerHeight * .5 * retreat;
          whySection.style.setProperty('--why-light-shift', whyLightShift.toFixed(3) + 'px');
          var reveal = whyClamp(1 - entranceTop / (whyLayout.entrance * .6), 1);
          reveal = reveal * reveal * (3 - 2 * reveal);
          whySection.style.setProperty('--why-reveal', reveal.toFixed(5));
          // The reassurance follows the headline by a tenth of the entrance.
          var noteReveal = whyClamp((entranceProgress - .5) / .5, 1);
          noteReveal = noteReveal * noteReveal * (3 - 2 * noteReveal);
          whySection.style.setProperty('--why-note-reveal', noteReveal.toFixed(5));
          whySection.classList.toggle('why--entered', entranceTop <= 1);
        }
        if (whyScroll.dataset.skipping === 'true' || !whyLayout.horizontal) return;
        var scrolled = -whyScroll.getBoundingClientRect().top;
        var progress = whyClamp((scrolled - whyLayout.hold) / whyLayout.journey, 1);
        whyScroll.style.setProperty('--why-x', (-progress * whyLayout.travel) + 'px');
        var currentSlide = Math.round(progress * (desktopSlides.length - 1));
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
      var oldLayout = whyLayout;
      var changedViewport = oldLayout && (oldLayout.width !== whySection.clientWidth || oldLayout.height !== window.innerHeight);
      var oldTop = changedViewport && typeof oldLayout.lastTop === 'number' ? oldLayout.lastTop : whyScroll.getBoundingClientRect().top;
      var entering = oldLayout && oldLayout.horizontal && oldTop > 0 && oldTop < oldLayout.entrance;
      var inside = oldLayout && oldLayout.horizontal && oldTop <= 0 && -oldTop <= oldLayout.runway;
      var oldProgress = inside ? whyClamp((-oldTop - oldLayout.hold) / oldLayout.journey, 1) : 0;
      var activeSlide = inside ? desktopSlides[Math.round(oldProgress * (desktopSlides.length - 1))] : null;
      var focused = track.contains(document.activeElement) ? document.activeElement : null;
      if (desktop !== whyOrderDesktop) {
        var ordered = desktop ? desktopSlides : originalSlides;
        ordered.forEach(function (slide, i) {
          track.appendChild(slide);
          var theme = desktop ? (i % 2 ? 'light' : 'dark') : originalThemes[i];
          slide.classList.toggle('slide--dark', theme === 'dark');
          slide.classList.toggle('slide--light', theme === 'light');
          slide.dataset.navTheme = theme;
        });
        whyOrderDesktop = desktop;
        if (focused) focused.focus({ preventScroll: true });
      }
      whySection.setAttribute('aria-labelledby', desktop ? 'why-intro-title' : 'why-title');
      whySection.style.setProperty('--why-unit', (whySection.clientWidth / 1280) + 'px');
      // Start with flow so intrinsic content determines whether pinning is safe.
      whySection.classList.remove('why--horizontal');
      var bar = document.querySelector('.topbar');
      var clearance = Math.max(72, bar ? bar.getBoundingClientRect().height + 24 : 72);
      var fits = desktopSlides.every(function (slide) {
        var inner = slide.querySelector('.slide__inner');
        return inner.scrollHeight + clearance * 2 <= window.innerHeight
          && inner.scrollWidth <= whySection.clientWidth - 48;
      });
      var horizontal = desktop && !whyReduced.matches && !shortScreen.matches && fits;
      whySection.classList.toggle('why--horizontal', horizontal);
      var firstLeft = desktopSlides[0].getBoundingClientRect().left;
      var offsets = desktopSlides.map(function (slide) { return slide.getBoundingClientRect().left - firstLeft; });
      var travel = horizontal ? offsets[offsets.length - 1] : 0;
      var hold = window.innerHeight * .2;
      var journey = window.innerHeight * 1.6 * (desktopSlides.length - 1);
      var runway = journey + hold * 2;
      var entrance = window.innerHeight;
      whyLayout = { horizontal: horizontal, travel: travel, hold: hold, journey: journey, runway: runway, offsets: offsets, entrance: entrance, width: whySection.clientWidth, height: window.innerHeight };
      whyScroll.style.setProperty('--why-height', (window.innerHeight + runway) + 'px');
      if (!horizontal) {
        whyScroll.style.removeProperty('--why-x');
        whySection.style.removeProperty('--why-reveal');
        whySection.style.removeProperty('--why-note-reveal');
      }
      track.tabIndex = horizontal ? 0 : -1;
      if (horizontal) track.setAttribute('aria-roledescription', 'carousel');
      else track.removeAttribute('aria-roledescription');
      // Keep the same point in the story when the laptop is resized. On leaving
      // the pinned layout, anchor the same article in the ordinary reading flow.
      var layoutChanged = oldLayout && (oldLayout.horizontal !== horizontal || Math.abs(oldLayout.travel - travel) > 1 || oldLayout.journey !== journey);
      if ((inside || entering) && layoutChanged && whyScroll.dataset.skipping !== 'true') {
        if (window.siteScroll) window.siteScroll.cancel();
        var destination = horizontal
          ? window.scrollY + whyScroll.getBoundingClientRect().top + (entering ? -oldTop / oldLayout.entrance * entrance : (-oldTop / oldLayout.runway) * runway)
          : window.scrollY + (activeSlide || whyIntro).getBoundingClientRect().top;
        window.scrollTo({ top: destination, behavior: 'instant' });
      }
      updateWhyScroll();
      if (typeof requestFrame === 'function') requestFrame();
    };
    var requestWhyMeasure = function () {
      if (!whyMeasureFrame) whyMeasureFrame = window.requestAnimationFrame(measureWhy);
    };
    whyDesktop.addEventListener('change', requestWhyMeasure);
    whyReduced.addEventListener('change', requestWhyMeasure);
    window.addEventListener('resize', requestWhyMeasure, { passive: true });
    if (document.fonts) document.fonts.ready.then(requestWhyMeasure);
    if ('ResizeObserver' in window) {
      var whyObserver = new ResizeObserver(requestWhyMeasure);
      desktopSlides.forEach(function (slide) { whyObserver.observe(slide.querySelector('.slide__inner')); });
    }
    measureWhy();

    // A direct desktop hash link should show the introduction, not its prelude.
    window.addEventListener('load', function () {
      var settleWhyHash = function () {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            if (window.location.hash !== '#why-us' || !whyLayout.horizontal) return;
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
    var navigateWhy = function (target, done) {
      if (cancelWhyFallback) cancelWhyFallback();
      if (window.siteScroll && window.siteScroll.to(target, done)) return true;
      if (whyReduced.matches) {
        window.scrollTo({ top: target, behavior: 'instant' });
        if (done) done();
        return true;
      }
      var start = window.scrollY, started = null, navigationFrame = 0;
      var finish = function () {
        window.cancelAnimationFrame(navigationFrame);
        cancelWhyFallback = null;
        if (done) done();
        if (typeof requestFrame === 'function') requestFrame();
      };
      cancelWhyFallback = finish;
      var step = function (time) {
        if (started === null) started = time;
        var p = Math.min(1, (time - started) / 600);
        var eased = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo({ top: start + (target - start) * eased, behavior: 'instant' });
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
          whyScroll.dataset.skipping = "true";
          
          var targetY = nextSection.getBoundingClientRect().top + window.scrollY;
          navigateWhy(targetY, function () {
            whyScroll.dataset.skipping = 'false';
            updateWhyScroll();
            if (typeof requestFrame === 'function') requestFrame();
          });
        }
      });
    }

    track.addEventListener("keydown", function (e) {
      if (!whyLayout || !whyLayout.horizontal || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var progress = whyClamp((-whyScroll.getBoundingClientRect().top - whyLayout.hold) / whyLayout.journey, 1);
        var current = progress * (desktopSlides.length - 1);
        var index = e.key === 'ArrowRight' ? Math.floor(current + .001) + 1 : Math.ceil(current - .001) - 1;
        index = whyClamp(index, desktopSlides.length - 1);
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
    var visible = {};
    var setActiveNav = function (id) {
      // The hero's scroll runway sits underneath Technology. Count the
      // visible white surface, rather than that hidden overlapping box.
      if (clarityEnabled && tech) {
        var boundary = tech.getBoundingClientRect();
        if (boundary.top > window.innerHeight * .5) id = 'home';
        else if (boundary.bottom > window.innerHeight * .5) id = 'technology';
      }
      navItems.forEach(function (a) { a.classList.toggle("nav__item--active", a.dataset.section === id); });
    };
    // Create an array of thresholds from 0 to 1 with 0.05 increments
    var thresholds = [];
    for (var i = 0; i <= 20; i++) thresholds.push(i / 20);
    
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRect.height : 0; });
      var best = null, bestVal = 0;
      sectionIds.forEach(function (id) { if (visible[id] > bestVal) { best = id; bestVal = visible[id]; } });
      if (best) setActiveNav(best);
    }, { threshold: thresholds, rootMargin: "-10% 0px -30% 0px" });
    sectionIds.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });

    // Custom fast smooth scroll for all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(function(item) {
      item.addEventListener("click", function(e) {
        var targetId = this.getAttribute("href");
        if (targetId === "#") return;
        var target = document.querySelector(targetId);
        if (!target) return;
        
        e.preventDefault();
        
        // Freeze the 'why us' track so it doesn't fast-forward
        var whyScroll = document.querySelector(".why__scroll-container");
        if (whyScroll) whyScroll.dataset.skipping = "true";
        
        var headerHeight = document.querySelector('.topbar').getBoundingClientRect().height;
        var headerOffset = targetId === '#technology' && target.classList.contains('features--desktop') ? headerHeight
          : !isDesktop() && targetId !== "#home" ? headerHeight + 12 : 0;
        var targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset);
        if (targetId === '#why-us' && whyLayout && whyLayout.horizontal) {
          targetY = window.scrollY + whyScroll.getBoundingClientRect().top;
        }
        var navigate = whyDesktop.matches && typeof navigateWhy === 'function' ? navigateWhy : window.siteScroll && window.siteScroll.to;
        if (navigate && navigate(targetY, function () {
          if (whyScroll) {
            whyScroll.dataset.skipping = 'false';
            window.dispatchEvent(new Event('scroll'));
          }
          if (typeof requestFrame === 'function') requestFrame();
        })) return;
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

  /* ---------------- Contact form ---------------- */
  var form = document.querySelector(".contact__form");
  if (form) {
    var formStatus = form.querySelector(".contact__status");
    var textarea = form.querySelector("textarea");
    if (textarea) {
      textarea.addEventListener("input", function () {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      });
    }

    var messages = {
      firstName: "Please enter your first name.",
      lastName: "Please enter your last name.",
      phone: "Please enter a phone number.",
      email: "Please enter a valid email address."
    };
    var validateField = function (input) {
      var field = input.closest(".field");
      var err = field && field.querySelector(".field__error");
      var ok = input.checkValidity();
      if (field) field.classList.toggle("is-invalid", !ok);
      if (err) err.textContent = ok ? "" : (messages[input.name] || "This field is required.");
      return ok;
    };
    form.querySelectorAll("input[required]").forEach(function (input) {
      input.addEventListener("blur", function () { if (input.value) validateField(input); });
      input.addEventListener("input", function () {
        var field = input.closest(".field");
        if (field && field.classList.contains("is-invalid") && input.checkValidity()) validateField(input);
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (form.elements.company && form.elements.company.value) return; // honeypot
      var firstInvalid = null;
      form.querySelectorAll("input[required]").forEach(function (input) {
        if (!validateField(input) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }
      if (formStatus) {
        formStatus.textContent = "Thanks — we’ve received your message and will get back to you shortly.";
        formStatus.classList.add("is-visible");
      }
      form.reset();
      if (textarea) textarea.style.height = "";
    });
  }

  /* ---------------- Scroll Reveals ---------------- */
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });

    document.querySelectorAll(".reveal-up").forEach(function(el) {
      revealObserver.observe(el);
    });
  }

  /* ---------------- Scroll-driven effects ----------------
     One scroll listener and one rAF per frame, with every measurement taken
     before any style is written. Previously the hero transition, the
     Technology reveal, the nav hide and the footer parallax each registered
     their own unthrottled listener, and each interleaved getBoundingClientRect
     with style writes — so a single scroll event forced layout several times
     over. Visual output is unchanged; only the scheduling differs. */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var hero = document.getElementById("home");
  // Both words share one persistent compositing layer. Wait for their actual
  // faces before moving it; neither animation completion nor menu use resets it.
  var phoneTitleRoot = document.documentElement;
  var phoneTitleMedia = window.matchMedia("(width < 600px)");
  var showStaticTitle = function () { phoneTitleRoot.dataset.phoneTitle = "static"; };
  if (phoneTitleRoot.dataset.phoneTitle === "pending") {
    if (document.fonts && !reduceMotion.matches) {
      Promise.all([
        document.fonts.load('72px "Anton"', 'TOILETS'),
        document.fonts.load('80px "Billion Dreams"', 'Redefined')
      ]).then(function (faces) {
        if (phoneTitleRoot.dataset.phoneTitle !== "pending") return;
        phoneTitleRoot.dataset.phoneTitle = faces.every(function (list) { return list.length > 0; }) && phoneTitleMedia.matches && !reduceMotion.matches ? "reveal" : "static";
      }, showStaticTitle);
    } else showStaticTitle();
  }
  phoneTitleMedia.addEventListener("change", showStaticTitle);
  reduceMotion.addEventListener("change", function (event) { if (event.matches) showStaticTitle(); });
  // Seal the one-time phone entrance so crossing responsive breakpoints does
  // not replay it. Final CSS remains visible even if JavaScript is unavailable.
  if (hero) {
    var finishHeroEntrance = function () { hero.classList.add("hero--entered"); };
    window.setTimeout(finishHeroEntrance, 2000);
    window.matchMedia("(width < 600px)").addEventListener("change", finishHeroEntrance);
  }
  var tech = document.getElementById("technology");
  var topbar = document.querySelector(".topbar");
  var footer = document.querySelector(".footer");
  var clouds = document.querySelector(".footer__clouds");
  var footerInner = document.querySelector(".footer__inner");

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
  // Deliberately not pre-set to "merge"/"dark" (the actual initial state):
  // applyTopbarSurface only writes an attribute when the value *changes*, and
  // the DOM starts with neither attribute present at all, so seeding these to
  // match would make the first real call a no-op and leave the bar without
  // data-mode/data-theme forever.
  var topbarMode = null;
  var topbarTheme = null;
  var applyTopbarSurface = function (mode, theme) {
    if (!topbar) return;
    if (!isDesktop() && menu && !menu.hidden) { mode = "glass"; theme = "dark"; }
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
      if (whyLayout && whyLayout.horizontal && whyRect.top > 0 && whyRect.top < whyLayout.entrance && !(menu && !menu.hidden)) {
        // Sample the actual moving colour surface; DOM hit testing cannot see
        // the decorative plane behind the transparent introduction.
        var washTheme = function (control) {
          var rect = control.getBoundingClientRect();
          var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
          var sy = (y - whyRect.top + window.innerHeight * .2 - whyLightShift) / window.innerHeight;
          var darkness = whyToneDarkness(sy);
          var underneath = document.elementFromPoint(x, topbar.getBoundingClientRect().bottom + 8);
          return sy >= .04 ? (darkness > .56 ? 'dark' : 'light') : inferBackgroundTheme(underneath);
        };
        applyTopbarSurface('merge', washTheme(topbarLogo || topbar));
        whyNavInk.forEach(function (control) { control.dataset.whySurface = washTheme(control); });
        return;
      }
      if (whyLayout && whyLayout.horizontal && whyRect.top <= 0 && whyRect.bottom >= window.innerHeight && !(menu && !menu.hidden)) {
        var barRect = topbar.getBoundingClientRect();
        var logoRect = topbarLogo ? topbarLogo.getBoundingClientRect() : null;
        var lx = logoRect ? Math.round(logoRect.left + logoRect.width / 2) : Math.round(barRect.left + 60);
        var ly = Math.round(barRect.bottom + 8);
        var themeAtLogo = themeOfSlideAt(lx, ly, null);
        applyTopbarSurface("merge", themeAtLogo || (whySticky ? whySticky.dataset.theme : "dark") || "dark");
        // A seam can sit between the logo and links. Each control follows the
        // surface directly beneath it rather than waiting for the far-left logo.
        whyNavInk.forEach(function (control) {
          var rect = control.getBoundingClientRect();
          if (!rect.width) return;
          var theme = themeOfSlideAt(rect.left + rect.width / 2, ly, null);
          if (theme && control.dataset.whySurface !== theme) control.dataset.whySurface = theme;
        });
        return;
      }
    }
    whyNavInk.forEach(function (control) { if (control.dataset.whySurface) delete control.dataset.whySurface; });

    var r = topbar.getBoundingClientRect();
    var probeX = Math.round(window.innerWidth / 2);
    var probeY = Math.round(r.bottom + 8); // just past the bar's own pixels
    var el = document.elementFromPoint(probeX, probeY);
    var modeEl = el && el.closest ? el.closest("[data-nav-mode]") : null;
    var mode = modeEl ? modeEl.dataset.navMode : "glass";
    var themeEl = el && el.closest ? el.closest("[data-nav-theme]") : null;
    var theme = themeEl ? themeEl.dataset.navTheme : inferBackgroundTheme(el);
    applyTopbarSurface(mode, theme);
  };

  var onFrame = function () {
    frame = 0;

    if (typeof updateWhyScroll === 'function') updateWhyScroll();

    var vh = window.innerHeight;
    var scrollY = window.scrollY;
    var still = reduceMotion.matches;

    /* ---- reads ---- */
    var heroRect = hero ? hero.getBoundingClientRect() : null;
    var techRect = tech && !still ? tech.getBoundingClientRect() : null;
    var footerRect = footer && clouds && footerInner ? footer.getBoundingClientRect() : null;

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
        else applyTopbarSurface('merge', lightInk ? 'light' : 'dark');
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

    if (footerRect) {
      var fMax = footerRect.height;
      var fScrolled = vh - footerRect.top;
      if (fScrolled > 0 && fScrolled <= vh + fMax) {
        var fP = Math.max(0, Math.min(1, fScrolled / fMax));
        footerInner.style.transform = "translateY(" + (1 - fP) * 100 + "px)";
        clouds.style.transform = "translateY(" + (1 - fP) * 200 + "px)";
        footerInner.style.opacity = fP;
        clouds.style.opacity = fP;
      } else if (fScrolled > vh + fMax) {
        footerInner.style.transform = "translateY(0)";
        clouds.style.transform = "translateY(0)";
        footerInner.style.opacity = 1;
        clouds.style.opacity = 1;
      } else {
        footerInner.style.opacity = 0;
        clouds.style.opacity = 0;
      }
    }
  };

  var requestFrame = function () {
    if (!frame) frame = window.requestAnimationFrame(onFrame);
  };

  if (window.siteScroll) window.siteScroll.onFrame(function () {
    // Paint the lighting on the same frame as the smoothed page position.
    if (frame) window.cancelAnimationFrame(frame);
    onFrame();
  });

  window.addEventListener("scroll", requestFrame, { passive: true });
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
        var targetY = nextSection.getBoundingClientRect().top + window.scrollY;
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
