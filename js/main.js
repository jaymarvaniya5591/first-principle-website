/* First Principle — landing page behaviour (no animations yet) */
(function () {
  "use strict";

  /* ---------------- Mobile menu ---------------- */
  var burger = document.querySelector(".hamburger");
  var menu = document.getElementById("mobile-menu");
  if (burger && menu) {
    var setMenu = function (open) {
      menu.hidden = !open;
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", function () { setMenu(menu.hidden); });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
  }

  /* ---------------- Features accordion ---------------- */
  var featureItems = document.querySelectorAll(".features__list .feature");
  var featureImgs = document.querySelectorAll(".features__img");
  function activateFeature(index) {
    featureItems.forEach(function (li) {
      var on = li.dataset.feature === String(index);
      li.classList.toggle("is-active", on);
      var btn = li.querySelector(".feature__btn");
      if (btn) btn.setAttribute("aria-expanded", String(on));
    });
    featureImgs.forEach(function (img) {
      img.classList.toggle("is-active", img.dataset.feature === String(index));
    });
  }
  featureItems.forEach(function (li) {
    var btn = li.querySelector(".feature__btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (li.classList.contains("is-active")) return;
      activateFeature(li.dataset.feature);
    });
  });

  /* ---------------- Collection carousel ---------------- */
  var cards = Array.prototype.slice.call(document.querySelectorAll(".carousel .card"));
  var positions = ["left", "center", "right"];
  function rotateCards(dir) {
    cards.forEach(function (card) {
      var i = positions.indexOf(card.dataset.pos);
      var next = (i - dir + positions.length) % positions.length;
      card.dataset.pos = positions[next];
    });
  }
  document.querySelectorAll(".carousel__arrow").forEach(function (btn) {
    btn.addEventListener("click", function () {
      rotateCards(parseInt(btn.dataset.dir, 10) || 1);
    });
  });

  /* ---------------- "Why us" horizontal track ----------------
     On desktop the slides sit in a horizontal snap track. Convert vertical
     wheel input into horizontal movement while the track can still move,
     so mouse users can reach every slide. */
  var track = document.querySelector(".why__track");
  if (track) {
    var isDesktop = function () { return window.matchMedia("(min-width: 768px)").matches; };
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

  /* ---------------- Contact form ---------------- */
  var form = document.querySelector(".contact__form");
  if (form) {
    var status = form.querySelector(".contact__status");
    var textarea = form.querySelector("textarea");
    if (textarea) {
      textarea.addEventListener("input", function () {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (status) {
        status.textContent = "Thanks — we’ve received your message and will get back to you shortly.";
        status.classList.add("is-visible");
      }
      form.reset();
    });
  }
})();
