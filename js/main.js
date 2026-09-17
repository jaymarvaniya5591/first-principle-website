/* First Principle — landing page behaviour. No animations yet (added in a later phase). */
(function () {
  "use strict";

  var isDesktop = function () { return window.matchMedia("(min-width: 900px)").matches; };

  /* ---------------- Hamburger visibility (responds to viewport changes) ---------------- */
  var _btn = document.querySelector(".hamburger");
  if (_btn) {
    var mobileStyles = [
      "display:flex", "flex-direction:column", "justify-content:center",
      "align-items:center", "gap:6px", "position:fixed",
      "top:20px", "right:20px", "width:48px", "height:48px",
      "background:#111111", "border:none", "border-radius:12px",
      "cursor:pointer", "z-index:9999"
    ].join(";");
    _btn.querySelectorAll("span").forEach(function (s) {
      s.style.cssText = "display:block;width:24px;height:2px;background:#ffffff;border-radius:2px;";
    });
    var applyHamburgerDisplay = function () {
      _btn.style.cssText = isDesktop() ? "display:none" : mobileStyles;
    };
    applyHamburgerDisplay();
    window.matchMedia("(min-width: 900px)").addEventListener("change", applyHamburgerDisplay);
  }

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector(".hamburger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    var setMenu = function (open) {
      menu.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) { var first = menu.querySelector("a"); if (first) first.focus({ preventScroll: true }); }
    };
    burger.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !menu.hidden) { setMenu(false); burger.focus(); }
    });
    window.matchMedia("(min-width: 900px)").addEventListener("change", function (mq) {
      if (mq.matches && !menu.hidden) setMenu(false);
    });
  }

  /* ---------------- Features accordion (Scroll-Driven / Click-Driven) ---------------- */
  var featuresSection = document.getElementById("technology");
  var featuresBody = document.querySelector(".features__body");
  var featureList = document.querySelector(".features__list");
  var featureItems = Array.prototype.slice.call(document.querySelectorAll(".features__list .feature"));
  var featureImgs = document.querySelectorAll(".features__img");

  if (featuresSection && featuresBody && featureList) {
    featuresSection.style.height = "auto";
    featuresSection.style.position = "static";

    var featuresMedia = document.getElementById("features-media");
    var isMobileFeatures = function() { return window.matchMedia("(max-width: 899px)").matches; };

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
    window.matchMedia("(max-width: 899px)").addEventListener("change", function(e) {
      if (!e.matches) restoreMedia();
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
  if (whyScroll && track && whySticky) {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      var whySlideEls = Array.prototype.slice.call(track.querySelectorAll(".slide"));
      var updateWhyScroll = function () {
        if (whyScroll.dataset.skipping === "true") return;
        var rect = whyScroll.getBoundingClientRect();
        var maxScroll = rect.height - window.innerHeight;
        var scrolled = -rect.top;
        if (maxScroll <= 0) return;

        if (window.matchMedia("(max-width: 899px)").matches) {
          // Mobile: vertical card-stack scroll hijack
          var totalProgress = Math.max(0, Math.min(1, scrolled / maxScroll));
          var numTransitions = whySlideEls.length - 1; // 4
          var slideProgress = totalProgress * numTransitions;
          var cur = Math.floor(slideProgress);
          var frac = slideProgress - cur; // 0..1 within current transition

          whySlideEls.forEach(function(slide, i) {
            var y;
            if (i <= cur) {
              y = 0;                         // already settled on screen
            } else if (i === cur + 1) {
              y = (1 - frac) * 100;          // entering from bottom
            } else {
              y = 100;                       // waiting below screen
            }
            slide.style.transform = "translateY(" + y + "%)";
          });

          // Keep data-theme in sync
          var activeIdx = Math.min(Math.round(totalProgress * numTransitions), whySlideEls.length - 1);
          whySticky.setAttribute("data-theme", activeIdx % 2 === 0 ? "dark" : "light");
          return;
        }

        // Desktop: horizontal slide via CSS custom property
        var progress = Math.max(0, Math.min(1, scrolled / maxScroll));
        whyScroll.style.setProperty('--why-progress', progress);
        var currentSlide = Math.round(progress * 4);
        whySticky.setAttribute("data-theme", currentSlide % 2 === 0 ? "dark" : "light");
      };
      window.addEventListener("scroll", updateWhyScroll, { passive: true });
      window.addEventListener("resize", updateWhyScroll, { passive: true });
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
        
        var targetY = target.getBoundingClientRect().top + window.scrollY;
        var startY = window.scrollY;
        var difference = targetY - startY;
        var startTime = null;
        var duration = 600; // 600ms is very fast and smooth
        
        function step(time) {
          if (startTime === null) startTime = time;
          var progress = Math.min((time - startTime) / duration, 1);
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
     One listener, one rAF per frame, all reads before all writes. Previously
     four independent scroll handlers each called getBoundingClientRect() and
     wrote styles, interleaving reads and writes and forcing repeated layout. */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var hero = document.getElementById("home");
  var tech = document.getElementById("technology");
  var topbar = document.querySelector(".topbar");
  var brandMobile = document.querySelector(".brand-mobile");
  var hamburger = document.querySelector(".hamburger");
  var footer = document.querySelector(".footer");
  var clouds = document.querySelector(".footer__clouds");
  var footerInner = document.querySelector(".footer__inner");

  /* Adaptive top bar ink. `.hero__fog-sentinel` is pinned to the exact gradient
     stop where the fog turns opaque white, so its position tells us when the
     capsule stops sitting on blue sky and starts sitting on white.

     The old test (`scrollY > hero.offsetHeight - 100`) fired about 440px of
     scroll too late, leaving white labels on a white background. */
  var sentinel = document.querySelector(".hero__fog-sentinel");
  var CHROME_DARK_AT = 88; // capsule bottom: 1.75rem top + 3.75rem height
  var CHROME_LIGHT_AT = 108; // 20px band so it cannot flicker at the boundary
  var chromeDark = false;

  var lastScrollY = window.scrollY;
  var chromeHidden = false;
  var bodyScrolled = false;
  // Hysteresis: the old handler flipped on any 1px direction change, which made
  // the bar twitch. Require sustained travel before changing state.
  var HIDE_AFTER = 8;
  var SHOW_AFTER = 12;
  var HIDE_FLOOR = 64;
  var travel = 0;

  var setChromeHidden = function (hidden) {
    if (hidden === chromeHidden) return;
    chromeHidden = hidden;
    if (topbar) topbar.classList.toggle("is-hidden", hidden);
    if (brandMobile) brandMobile.classList.toggle("is-hidden", hidden);
    if (hamburger) hamburger.classList.toggle("is-hidden", hidden);
  };

  var frame = 0;
  var onFrame = function () {
    frame = 0;

    var vh = window.innerHeight;
    var scrollY = window.scrollY;

    /* ---- reads ---- */
    var heroRect = hero ? hero.getBoundingClientRect() : null;
    var techRect = tech ? tech.getBoundingClientRect() : null;
    var footerRect = footer ? footer.getBoundingClientRect() : null;
    var sentinelTop = sentinel ? sentinel.getBoundingClientRect().top : null;

    /* ---- writes ---- */
    if (topbar && sentinelTop !== null) {
      var wantDark = chromeDark
        ? sentinelTop < CHROME_LIGHT_AT
        : sentinelTop <= CHROME_DARK_AT;
      if (wantDark !== chromeDark) {
        chromeDark = wantDark;
        topbar.classList.toggle("is-chrome-dark", wantDark);
      }
    }

    if (heroRect) {
      // Mobile inverts its brand mark off this flag.
      var pastHero = scrollY > heroRect.height - 100;
      if (pastHero !== bodyScrolled) {
        bodyScrolled = pastHero;
        document.body.classList.toggle("is-scrolled", pastHero);
      }
    }

    if (heroRect && !reduceMotion.matches) {
      var heroMax = heroRect.height - vh;
      if (heroMax > 0) {
        var p = Math.max(0, Math.min(1, -heroRect.top / heroMax));
        hero.style.setProperty("--scroll-p", p);
      }
    }

    if (techRect && !reduceMotion.matches) {
      var start = vh;
      var end = vh - 300;
      var techP = 1 - Math.max(0, Math.min(1, (techRect.top - end) / (start - end)));
      tech.style.setProperty("--tech-scroll-p", techP);
    }

    var delta = scrollY - lastScrollY;
    if (delta !== 0) {
      travel = delta > 0 === travel > 0 ? travel + delta : delta;
      if (scrollY <= HIDE_FLOOR) {
        setChromeHidden(false);
      } else if (travel > HIDE_AFTER) {
        setChromeHidden(true);
      } else if (travel < -SHOW_AFTER) {
        setChromeHidden(false);
      }
      lastScrollY = scrollY;
    }

    if (footerRect && clouds && footerInner) {
      var footerMax = footerRect.height;
      var scrolled = vh - footerRect.top;
      if (scrolled > 0 && scrolled <= vh + footerMax) {
        var fp = Math.max(0, Math.min(1, scrolled / footerMax));
        footerInner.style.transform = "translateY(" + (1 - fp) * 100 + "px)";
        clouds.style.transform = "translateY(" + (1 - fp) * 200 + "px)";
        footerInner.style.opacity = fp;
        clouds.style.opacity = fp;
      } else if (scrolled > vh + footerMax) {
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
  window.addEventListener("resize", requestFrame, { passive: true });
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
