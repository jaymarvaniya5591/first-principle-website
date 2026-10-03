/* Mobile product disclosure, compact navigation and bounded reading assistance.
   Desktop carousel positioning remains owned by main.js and its existing CSS. */
(function () {
  'use strict';
  var section = document.getElementById('product');
  if (!section) return;
  var carousel = section.querySelector('.carousel');
  var cards = Array.from(carousel.querySelectorAll('.card'));
  var header = document.querySelector('.topbar');
  var cardDeck = carousel.cardDeck;
  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  var expanded = false, scrollFrame = 0;
  var heightAnimation = null;
  var savedAnchor = null, anchorTimer = 0, scrollGeneration = 0;
  var current = function () { return cards[Number(carousel.dataset.active) || 0]; };
  var headerBottom = function () { return header.getBoundingClientRect().bottom; };
  var clamp = function (n, min, max) { return Math.max(min, Math.min(max, n)); };

  function releaseAnchor() {
    clearTimeout(anchorTimer);
    if (savedAnchor !== null) document.documentElement.style.overflowAnchor = savedAnchor;
    savedAnchor = null;
  }
  function holdAnchor() {
    if (savedAnchor === null) savedAnchor = document.documentElement.style.overflowAnchor;
    document.documentElement.style.overflowAnchor = 'none';
    clearTimeout(anchorTimer);
    anchorTimer = setTimeout(releaseAnchor, 300);
  }
  function stopScroll() { cancelAnimationFrame(scrollFrame); scrollFrame = 0; scrollGeneration++; }
  function alignPhoto() {
    stopScroll();
    var start = scrollY;
    var target = clamp(start + (cardDeck ? cardDeck.element : current()).getBoundingClientRect().top - headerBottom() - 12,
      0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
    if (Math.abs(target - start) < 1) return;
    if (window.siteScroll) window.siteScroll.cancel();
    if (reduced.matches) { window.scrollTo({top:target,behavior:'instant'}); return; }
    var began = performance.now();
    function step(time) {
      var t = Math.min(1, (time - began) / 220);
      var ease = t*t*t*(t*(t*6-15)+10);
      window.scrollTo({top:start+(target-start)*ease,behavior:'instant'});
      if (t < 1) scrollFrame = requestAnimationFrame(step);
      else scrollFrame = 0;
    }
    scrollFrame = requestAnimationFrame(step);
  }
  function requestMeasure() { if (cardDeck) cardDeck.measure(); }
  function cancelHeight() {
    if (heightAnimation) heightAnimation.cancel();
    heightAnimation = null;
    cards.forEach(function (card) { card.querySelector('.card__details').style.removeProperty('height'); });
  }
  function setDisclosures() {
    cards.forEach(function (card) {
      var button = card.querySelector('.card__disclosure');
      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = expanded ? 'Hide features' : 'View all 13 features';
      button.setAttribute('aria-label',button.textContent);
      card.querySelector('.card__details').hidden = !desktop.matches && !expanded;
    });
  }
  function toggleFeatures(open, fromBottom) {
    if (desktop.matches) return;
    stopScroll(); holdAnchor();
    var intent = scrollGeneration;
    var card = current(), panel = card.querySelector('.card__details');
    var from = panel.hidden ? 0 : panel.getBoundingClientRect().height;
    cancelHeight();
    expanded = open;
    setDisclosures();
    var to = open ? panel.getBoundingClientRect().height : 0;
    if (!open && fromBottom) card.querySelector('.card__disclosure').focus({preventScroll:true});
    if (!reduced.matches && Math.abs(to-from)>1) {
      panel.hidden = false;
      var animation = panel.animate([{height:from+'px'},{height:to+'px'}], {duration:180,easing:'cubic-bezier(.2,.7,.2,1)'});
      heightAnimation = animation;
      animation.onfinish = function () {
        if (heightAnimation !== animation) return;
        heightAnimation = null; panel.hidden = !expanded;
        if (!expanded && intent === scrollGeneration && card.getBoundingClientRect().top < headerBottom()+12) alignPhoto();
      };
    } else if (!expanded && intent === scrollGeneration && card.getBoundingClientRect().top < headerBottom()+12) alignPhoto();
  }
  cards.forEach(function (card) {
    card.querySelector('.card__disclosure').addEventListener('click', function () { toggleFeatures(!expanded,false); });
    card.querySelector('.card__collapse').addEventListener('click', function () { toggleFeatures(false,true); });
  });
  carousel.onProductChange = function (change) {
    if (desktop.matches) return;
    stopScroll(); cancelHeight(); holdAnchor();
    setDisclosures();
    if (cardDeck) cardDeck.change(change);
    // The old disclosure may have been keyboard-focused before a swipe/key switch.
    if (cards.some(function(card){return card.inert && card.contains(document.activeElement);})) {
      current().querySelector('.card__disclosure').focus({preventScroll:true});
    }
    if (expanded && (!change || change.source !== 'drag')) alignPhoto();
  };
  function reconcile() {
    stopScroll(); cancelHeight(); releaseAnchor();
    section.classList.add('product--enhanced');
    section.classList.toggle('product--mobile', !desktop.matches);
    setDisclosures();
    requestMeasure();
  }
  desktop.addEventListener('change',reconcile);
  reduced.addEventListener('change',reconcile);
  ['wheel','touchstart','pointerdown','keydown'].forEach(function(type){window.addEventListener(type,stopScroll,{passive:true,capture:true});});
  window.addEventListener('resize', stopScroll, {passive:true});
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { requestMeasure(); return; }
    stopScroll(); cancelHeight(); releaseAnchor(); setDisclosures();
  });
  reconcile();
})();
