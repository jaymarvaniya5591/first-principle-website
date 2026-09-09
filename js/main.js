/* First Principle — landing page behaviour. No animations yet (added in a later phase). */
(function () {
  "use strict";

  var isDesktop = function () { return window.matchMedia("(min-width: 900px)").matches; };

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

  /* ---------------- Features accordion ---------------- */
  var featureList = document.querySelector(".features__list");
  var featureItems = Array.prototype.slice.call(document.querySelectorAll(".features__list .feature"));
  var featureImgs = document.querySelectorAll(".features__img");

  function activateFeature(index, opts) {
    index = String(index);
    featureItems.forEach(function (li) {
      var on = li.dataset.feature === index;
      li.classList.toggle("is-active", on);
      var btn = li.querySelector(".feature__btn");
      if (btn) {
        btn.setAttribute("aria-expanded", String(on));
        btn.tabIndex = on ? -1 : 0;
      }
      if (on && opts && opts.scroll) {
        // Desktop: the 800px list clips; keep the active row in view (Figma variants 4-7).
        if (isDesktop() && featureList) {
          var top = li.offsetTop;
          var max = featureList.scrollHeight - featureList.clientHeight;
          featureList.scrollTop = Math.min(top, max);
        }
      }
    });
    featureImgs.forEach(function (pic) {
      pic.classList.toggle("is-active", pic.dataset.feature === index);
    });
  }

  featureItems.forEach(function (li, i) {
    var btn = li.querySelector(".feature__btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (li.classList.contains("is-active")) return;
      activateFeature(li.dataset.feature, { scroll: true });
      // Keep focus on something sensible: the newly active row's button is inert, so focus the row.
      li.setAttribute("tabindex", "-1");
      li.focus({ preventScroll: true });
    });
    btn.addEventListener("keydown", function (e) {
      var next = null;
      if (e.key === "ArrowDown") next = featureItems[(i + 1) % featureItems.length];
      else if (e.key === "ArrowUp") next = featureItems[(i - 1 + featureItems.length) % featureItems.length];
      else if (e.key === "Home") next = featureItems[0];
      else if (e.key === "End") next = featureItems[featureItems.length - 1];
      if (!next) return;
      e.preventDefault();
      var nb = next.querySelector(".feature__btn");
      if (next.classList.contains("is-active")) { next.setAttribute("tabindex", "-1"); next.focus(); }
      else if (nb) nb.focus();
    });
  });
  // Initial state: the first row is active and its button is inert.
  var initialActive = document.querySelector(".features__list .feature.is-active .feature__btn");
  if (initialActive) initialActive.tabIndex = -1;

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

  /* ---------------- "Why us" horizontal track ----------------
     On desktop the slides sit in a horizontal snap track. Convert vertical
     wheel input into horizontal movement while the track can still move,
     so mouse users can reach every slide. */
  var track = document.querySelector(".why__track");
  if (track) {
    track.addEventListener("wheel", function (e) {
      if (!isDesktop()) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already horizontal
      var max = track.scrollWidth - track.clientWidth;
      var atStart = track.scrollLeft <= 0;
      var atEnd = track.scrollLeft >= max - 1;
      if ((e.deltaY > 0 && !atEnd) || (e.deltaY < 0 && !atStart)) {
        e.preventDefault();
        track.scrollLeft += e.deltaY;
      }
    }, { passive: false });

    track.addEventListener("keydown", function (e) {
      if (!isDesktop()) return;
      if (e.key === "ArrowRight") { e.preventDefault(); track.scrollLeft += track.clientWidth; }
      if (e.key === "ArrowLeft") { e.preventDefault(); track.scrollLeft -= track.clientWidth; }
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
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0; });
      var best = null, bestRatio = 0;
      sectionIds.forEach(function (id) { if (visible[id] > bestRatio) { best = id; bestRatio = visible[id]; } });
      if (best) setActiveNav(best);
    }, { threshold: [0.15, 0.35, 0.6], rootMargin: "-10% 0px -40% 0px" });
    sectionIds.forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
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
})();
