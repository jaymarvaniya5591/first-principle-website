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

  /* ---------------- Features accordion (Scroll-Driven / Click-Driven) ---------------- */
  var featuresSection = document.getElementById("technology");
  var featuresBody = document.querySelector(".features__body");
  var featureList = document.querySelector(".features__list");
  var featureItems = Array.prototype.slice.call(document.querySelectorAll(".features__list .feature"));
  var featureImgs = document.querySelectorAll(".features__img");

  if (featuresSection && featuresBody && featureList) {
    var featuresMedia = document.getElementById("features-media");
    var isMobileFeatures = function() { return !isDesktop(); };

    // Move media panel into a given feature card (mobile only)
    function moveMobileMedia(li) {
      if (!featuresMedia || !li) return;
      if (!li.contains(featuresMedia)) {
        li.insertBefore(featuresMedia, li.firstChild);
      }
    }

    // Restore media panel to its original position in features body (desktop)
    function restoreMedia() {
      if (!featuresMedia || !featuresBody) return;
      if (!featuresBody.contains(featuresMedia) || featuresMedia.parentElement !== featuresBody) {
        featuresBody.insertBefore(featuresMedia, featuresBody.firstChild);
      }
    }

    // Initialize first feature as active
    activateFeatureScroll(0);

    // On mobile: move media into the first card on init
    if (isMobileFeatures()) {
      moveMobileMedia(featureItems[0]);
    }

    // Desktop scroll spy (skip on mobile — click-only on mobile)
    window.addEventListener("scroll", function() {
      if (isMobileFeatures()) return;
      var triggerY = window.innerHeight * 0.4;
      var bestIndex = 0;
      featureItems.forEach(function(li, i) {
        var rect = li.getBoundingClientRect();
        if (rect.top <= triggerY) bestIndex = i;
      });
      activateFeatureScroll(bestIndex);
    }, { passive: true });

    // Click interaction (mobile: open card with image inside; desktop: also works as accordion)
    featureItems.forEach(function(li, i) {
      li.style.cursor = "pointer";
      li.addEventListener("click", function() {
        if (li.classList.contains("is-active")) {
          activateFeatureScroll(-1);
        } else {
          activateFeatureScroll(i);
          if (isMobileFeatures()) moveMobileMedia(li);
        }
      });
    });

    // On resize to desktop: put media back where it belongs
    desktopMedia.addEventListener("change", function(e) {
      if (e.matches) restoreMedia();
      else moveMobileMedia(featureItems.find(function(li) { return li.classList.contains("is-active"); }) || featureItems[0]);
    });
  }

  function activateFeatureScroll(index) {
    var indexStr = String(index);
    featureItems.forEach(function (li) {
      var on = li.dataset.feature === indexStr;
      if (on !== li.classList.contains("is-active")) {
        li.classList.toggle("is-active", on);
        var btn = li.querySelector(".feature__btn");
        if (btn) {
          btn.setAttribute("aria-expanded", String(on));
          btn.tabIndex = on ? -1 : 0;
        }
      }
    });
    
    // Only update images and layout if we are opening a feature.
    if (index !== -1) {
      featureImgs.forEach(function (pic) {
        var on = pic.dataset.feature === indexStr;
        if (on !== pic.classList.contains("is-active")) {
          pic.classList.toggle("is-active", on);
        }
      });
    }
  }

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

  /* Slides translate right-to-left (`translateX(progress * -400vw)`), so a
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

  if (whyScroll && track && whySticky) {
    {
      var updateWhyScroll = function () {
        if (whyScroll.dataset.skipping === "true") return;
        if (!isDesktop() || shortScreen.matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        var rect = whyScroll.getBoundingClientRect();
        var maxScroll = rect.height - window.innerHeight;
        var scrolled = -rect.top;
        if (maxScroll <= 0) return;

        // Desktop: horizontal slide via CSS custom property
        var progress = Math.max(0, Math.min(1, scrolled / maxScroll));
        whyScroll.style.setProperty('--why-progress', progress);
        var currentSlide = Math.round(progress * 4);
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
      window.addEventListener("scroll", updateWhyScroll, { passive: true });
      window.addEventListener("resize", updateWhyScroll, { passive: true });
      window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", updateWhyScroll);
      updateWhyScroll();
    }
    
    var skipBtn = document.getElementById("skip-why");
    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        var nextSection = document.getElementById("product");
        if (nextSection) {
          whyScroll.dataset.skipping = "true";
          
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
              requestAnimationFrame(step);
            } else {
              whyScroll.dataset.skipping = "false"; 
              updateWhyScroll();
              // Force the topbar to re-sample its final resting surface
              // directly, rather than relying only on a "scroll" event
              // having been processed during the jump - see the matching
              // note on the general anchor-click handler below.
              if (typeof requestFrame === "function") requestFrame();
            }
          }
          requestAnimationFrame(step);
        }
      });
    }

    track.addEventListener("keydown", function (e) {
      if (!isDesktop()) return;
      if (e.key === "ArrowRight") { e.preventDefault(); window.scrollBy({ top: window.innerHeight, behavior: 'smooth' }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); window.scrollBy({ top: -window.innerHeight, behavior: 'smooth' }); }
    });
  }

  /* ---------------- Nav: highlight the section in view ---------------- */
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__item"));
  if (navItems.length && "IntersectionObserver" in window) {
    var sectionIds = navItems.map(function (a) { return a.dataset.section; });
    var visible = {};
    var setActiveNav = function (id) {
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
        
        var headerOffset = !isDesktop() && targetId !== "#home" ? document.querySelector('.topbar').getBoundingClientRect().height + 12 : 0;
        var targetY = Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerOffset);
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
  var fogOverlay = document.querySelector(".hero__fog-overlay");
  var tech = document.getElementById("technology");
  var topbar = document.querySelector(".topbar");
  var footer = document.querySelector(".footer");
  var clouds = document.querySelector(".footer__clouds");
  var footerInner = document.querySelector(".footer__inner");

  var bodyScrolled = false;
  var frame = 0;

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

  /* ---------------- Topbar surface: mode (merge/glass) x theme (light/dark)
     Inside the hero, the bespoke fog-front geometry below is authoritative
     (the fog is a custom animated gradient + image, not a plain element with
     its own background-color, so naive sampling cannot see it). Everywhere
     past the hero, `sampleBelowHeroSurface` mirrors the reference bar's own
     technique: hit-test whatever is actually behind the bar right now, read
     an explicit data-nav-mode/data-nav-theme off the nearest tagged ancestor
     (the why-us slides, the flat contact section, the footer), and otherwise
     infer light/dark from the sampled element's own computed background
     colour. That is what makes the bar merge into the why-us section's grey
     and black slides exactly the way it merges into the hero's sky, instead
     of showing a permanently white-tinted bar that seams against them. */
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

  var sampleBelowHeroSurface = function () {
    if (!topbar) return;

    /* The why-us section is a horizontal scroll-snap carousel: two flat-
       coloured slides are often visible side by side mid-transition. Sample
       at the LOGO's own actual position (not the viewport centre, and not a
       generic global progress snap) so its own ink/filter flips exactly when
       the slide truly behind IT changes - matching how `themeOfSlideAt`
       above times the skip button off its own position instead. Slides move
       right-to-left, so the logo (far left) is the last point a new slide
       reaches; sampling there is deliberately the "safest, latest" trigger
       for the whole bar, since by the time it fires, everything positioned
       further right (the nav links) has already been under the new slide's
       colour for a while - not the reverse. */
    if (whyScroll) {
      var whyRect = whyScroll.getBoundingClientRect();
      if (whyRect.top <= 0 && whyRect.bottom >= 0) {
        var barRect = topbar.getBoundingClientRect();
        var logoRect = topbarLogo ? topbarLogo.getBoundingClientRect() : null;
        var lx = logoRect ? Math.round(logoRect.left + logoRect.width / 2) : Math.round(barRect.left + 60);
        var ly = Math.round(barRect.bottom + 8);
        var themeAtLogo = themeOfSlideAt(lx, ly, null);
        applyTopbarSurface("merge", themeAtLogo || (whySticky ? whySticky.dataset.theme : "dark") || "dark");
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
    applyTopbarSurface(mode, theme);
  };

  var onFrame = function () {
    frame = 0;

    var vh = window.innerHeight;
    var scrollY = window.scrollY;
    var still = reduceMotion.matches;

    /* ---- reads ---- */
    var heroRect = hero ? hero.getBoundingClientRect() : null;
    var techRect = tech && !still ? tech.getBoundingClientRect() : null;
    var footerRect = footer && clouds && footerInner ? footer.getBoundingClientRect() : null;

    /* ---- writes ---- */
    var heroP = 0;
    if (heroRect) {
      var heroMax = heroRect.height - vh;
      if (heroMax > 0) heroP = Math.max(0, Math.min(1, -heroRect.top / heroMax));
      var pinnedHero = isDesktop() && !shortScreen.matches && !wideScreen.matches && !still;
      if (fogOverlay && pinnedHero) {
        // Set on the fog overlay rather than the hero, so the custom property
        // only invalidates the four fog layers instead of the whole hero tree.
        fogOverlay.style.setProperty("--scroll-p", heroP);
      }

      /* The chrome turns dark (and the desktop glass fades in) once the fog's
         cloud texture is APPROACHING the bar - not once it is already fully
         opaque white there. `whiteFront` is the fog's opaque-white boundary;
         its own cloud artwork starts fading in ~50vh above that boundary, so
         triggering right at `whiteFront <= chromeBottom` (the old test) meant
         the switch happened only once the bar already had faint cloud haze
         behind it, which is exactly when white-on-white starts losing
         contrast. ACTIVATE_LEAD pulls the trigger ~500px earlier, while the
         sky behind the bar is still genuinely flat, so the crossfade always
         finishes before there is anything to lose contrast against. Verified
         by screenshotting the transition zone at several scroll depths.
         The sticky pane pins at 0 until the hero's bottom enters the viewport;
         the fog's opaque-white stop sits 50vh into a layer anchored one
         viewport below it and travelling 100vh up. */
      var ACTIVATE_LEAD = 550;
      var stickyTop = Math.min(0, heroRect.bottom - vh);
      var whiteFront = stickyTop + vh * (1.5 - heroP);
      var glassEngaged = !pinnedHero ? heroRect.bottom < chromeBottom : bodyScrolled
        ? whiteFront < chromeBottom + ACTIVATE_LEAD + 100 // wide band so it cannot flicker
        : whiteFront <= chromeBottom + ACTIVATE_LEAD;
      // The flowing mobile hero gains glass on scroll, before its bottom
      // reaches the bar. Separate entry/exit thresholds avoid flicker.
      if (!isDesktop()) glassEngaged = bodyScrolled ? scrollY > 8 : scrollY > 24;
      if (glassEngaged !== bodyScrolled) {
        bodyScrolled = glassEngaged;
        document.body.classList.toggle("is-scrolled", glassEngaged);
      }

      // `whiteFront <= chromeBottom` (no lead) means the fog has genuinely
      // finished resolving to opaque white at the bar - the actual page DOM
      // is what is visible there now, not the fog's own animated gradient/
      // image, so it is safe to hand off to the generic sampler below.
      if ((!pinnedHero && heroRect.bottom <= chromeBottom) || (pinnedHero && whiteFront <= chromeBottom)) {
        sampleBelowHeroSurface();
      } else {
        // Still inside the hero or its fog transition: this bespoke
        // calculation is authoritative, because the fog is a custom
        // animated background-image, not a plain element the generic
        // sampler could read a background-color from.
        applyTopbarSurface(glassEngaged ? "glass" : "merge", "dark");
      }
    }

    if (techRect) {
      var start = vh; // entering viewport
      var end = vh - 300; // 300px into viewport
      var techP = 1 - Math.max(0, Math.min(1, (techRect.top - end) / (start - end)));
      tech.style.setProperty("--tech-scroll-p", techP);
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

  window.addEventListener("scroll", requestFrame, { passive: true });
  window.addEventListener(
    "resize",
    function () {
      measureChrome();
      requestFrame();
    },
    { passive: true }
  );
  measureChrome();
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
