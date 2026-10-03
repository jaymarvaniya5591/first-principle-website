/* Small, one-shot entrances, with readable HTML as the default. Why-us uses
   the existing reversible scroll clock rather than a second animation loop. */
(function () {
  'use strict';
  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  if (!('IntersectionObserver' in window)) return;
  function wrap(node, index) {
    var windowEl = document.createElement('span');
    var phrase = document.createElement('span');
    windowEl.className = 'motion-window';
    phrase.className = 'motion-phrase';
    windowEl.style.setProperty('--phrase-order', index);
    node.parentNode.insertBefore(windowEl, node);
    phrase.appendChild(node);
    windowEl.appendChild(phrase);
  }
  document.querySelectorAll('#technology h2, #product h2, .contact__title, .mobile-menu__nav a, #why-us .slide:not(.slide--intro) .slide__title').forEach(function (title) {
    // Wrap existing phrases, not individual letters. Whitespace, emphasis and
    // ordinary text wrapping survive; wrappers are display:contents on desktop.
    Array.from(title.childNodes).filter(function (node) {
      return node.nodeName !== 'BR' && node.textContent.trim();
    }).forEach(wrap);
    title.classList.add('motion-title');
  });
  var targets = [];
  function add(selector, delay, kind) {
    document.querySelectorAll(selector).forEach(function (el, index) {
      el.classList.add('motion-managed', kind || 'motion-rise');
      el.style.setProperty('--entrance-delay', (delay ? index * delay : 0) + 'ms');
      targets.push(el);
    });
  }
  // Parent reveals must not hide children that now have their own entrance.
  document.querySelectorAll('#technology .section-head, #product .section-head, .contact__form, .contact__copy').forEach(function (el) {
    el.classList.add('motion-managed');
  });
  add('#technology h2, #product h2, .contact__title', 0, 'motion-heading');
  add('#technology .section-head__sub, #product .section-head__sub, .contact__text', 0);
  add('.contact__fields .field:not(.field--hp)', 60, 'motion-field');
  add('.contact__form .submit', 0);
  add('.collection-shell, #support', 0, 'motion-boundary');
  var carousel = document.querySelector('.carousel');
  if (carousel && carousel.cardDeck) {
    var deck = carousel.cardDeck.element;
    deck.classList.add('motion-managed', 'motion-rise');
    targets.push(deck);
  }
  var seen = new WeakSet(), observer;
  function reveal(el) {
    el.classList.add('motion-visible');
    seen.add(el);
    if (observer) observer.unobserve(el);
    if (carousel && carousel.cardDeck && el === carousel.cardDeck.element) carousel.cardDeck.enter();
  }
  function reconcile() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) reveal(entry.target); });
    }, {rootMargin:'0px 0px -25% 0px', threshold:0});
    targets.forEach(function (el) {
      if (desktop.matches) { el.classList.remove('motion-pending'); return; }
      if (reduced.matches || seen.has(el) || el.getBoundingClientRect().bottom < 0) { reveal(el); return; }
      el.classList.add('motion-pending');
      observer.observe(el);
    });
  }
  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', reconcile);
  // A focused form control must never wait for a decorative entrance.
  document.addEventListener('focusin', function (event) {
    var field = event.target.closest('.motion-managed');
    if (field) reveal(field);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) targets.forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < innerHeight && rect.bottom > 0) reveal(el);
    });
  });
  reconcile();
})();
