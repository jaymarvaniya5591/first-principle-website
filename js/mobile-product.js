/* Mobile product disclosure, full-height wings and bounded reading assistance.
   Desktop carousel positioning remains owned by main.js and its existing CSS. */
(function () {
  'use strict';
  var section = document.getElementById('product');
  if (!section) return;
  var carousel = section.querySelector('.carousel');
  var cards = Array.from(carousel.querySelectorAll('.card'));
  var header = document.querySelector('.topbar');
  var heading = section.querySelector('.section-head');
  var desktop = matchMedia('(min-width:1100px), (min-width:600px) and (min-aspect-ratio:4/3) and (hover:hover) and (pointer:fine)');
  var reduced = matchMedia('(prefers-reduced-motion:reduce)');
  var expanded = false, frame = 0, scrollFrame = 0, measureFrame = 0;
  var heightAnimation = null, fadeAnimation = null, oldWidth = 0, oldHeight = 0;
  var savedAnchor = null, anchorTimer = 0, scrollGeneration = 0;
  var current = function () { return cards[Number(carousel.dataset.active) || 0]; };
  var viewportHeight = function () { return window.visualViewport ? visualViewport.height : innerHeight; };
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
    var target = clamp(start + current().getBoundingClientRect().top - headerBottom() - 12,
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
  function paintWings() {
    frame = 0;
    if (desktop.matches) return;
    var rect = current().getBoundingClientRect();
    var top = Math.max(rect.top, headerBottom()+12);
    var bottom = Math.min(rect.bottom, viewportHeight()-12);
    var centre = bottom > top ? (top+bottom)/2 : rect.top+rect.height/2;
    carousel.style.setProperty('--wing-y', clamp(centre-rect.top,22,Math.max(22,rect.height-22))+'px');
  }
  function requestWings() { if (!frame) frame = requestAnimationFrame(paintWings); }
  function measurePhoto() {
    measureFrame = 0;
    if (desktop.matches) return;
    var card = current(), body = card.querySelector('.card__body');
    var style = getComputedStyle(body);
    var chrome = card.querySelector('.card__head').getBoundingClientRect().height
      + card.querySelector('.card__disclosure').getBoundingClientRect().height
      + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      + parseFloat(style.rowGap)*2 + parseFloat(getComputedStyle(card).paddingBottom) + 2;
    var available = viewportHeight() - headerBottom() - 12
      - heading.getBoundingClientRect().height - parseFloat(getComputedStyle(heading).marginBottom) - 12;
    var minimumPhoto = section.clientWidth >= 500 && viewportHeight() < 500 ? 160 : 96;
    section.style.setProperty('--mobile-product-photo', Math.max(minimumPhoto,Math.min(300,card.clientWidth,available-chrome))+'px');
    oldWidth = section.clientWidth; oldHeight = viewportHeight();
    requestWings();
  }
  function requestMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measurePhoto); }
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
        requestWings();
        if (!expanded && intent === scrollGeneration && card.getBoundingClientRect().top < headerBottom()+12) alignPhoto();
      };
    } else if (!expanded && intent === scrollGeneration && card.getBoundingClientRect().top < headerBottom()+12) alignPhoto();
    requestWings();
  }
  cards.forEach(function (card) {
    card.querySelector('.card__disclosure').addEventListener('click', function () { toggleFeatures(!expanded,false); });
    card.querySelector('.card__collapse').addEventListener('click', function () { toggleFeatures(false,true); });
  });
  carousel.onProductChange = function () {
    if (desktop.matches) return;
    stopScroll(); cancelHeight(); holdAnchor();
    if (fadeAnimation) fadeAnimation.cancel();
    setDisclosures(); measurePhoto();
    // The old disclosure may have been keyboard-focused before a swipe/key switch.
    if (cards.some(function(card){return card.inert && card.contains(document.activeElement);})) {
      current().querySelector('.card__disclosure').focus({preventScroll:true});
    }
    if (!reduced.matches) fadeAnimation = current().animate([{opacity:.55},{opacity:1}], {duration:120,easing:'ease-out'});
    if (expanded) alignPhoto();
    requestWings();
  };
  function reconcile() {
    stopScroll(); cancelHeight(); releaseAnchor();
    if (fadeAnimation) fadeAnimation.cancel();
    section.classList.add('product--enhanced');
    section.classList.toggle('product--mobile', !desktop.matches);
    setDisclosures();
    if (desktop.matches) section.style.removeProperty('--mobile-product-photo');
    else measurePhoto();
  }
  desktop.addEventListener('change',reconcile);
  reduced.addEventListener('change',reconcile);
  ['wheel','touchstart','pointerdown','keydown'].forEach(function(type){window.addEventListener(type,stopScroll,{passive:true,capture:true});});
  window.addEventListener('scroll',requestWings,{passive:true});
  window.addEventListener('resize',function(){
    stopScroll();
    // Browser toolbar growth does not enlarge the photo halfway through reading.
    if (section.clientWidth !== oldWidth || viewportHeight() < oldHeight-32) requestMeasure();
    requestWings();
  },{passive:true});
  if (window.visualViewport) visualViewport.addEventListener('resize',function(){
    if (viewportHeight()<oldHeight-32) requestMeasure();
    requestWings();
  },{passive:true});
  new ResizeObserver(requestWings).observe(carousel.querySelector('.carousel__stage'));
  new ResizeObserver(requestMeasure).observe(header);
  new ResizeObserver(requestMeasure).observe(heading);
  var contentObserver = new ResizeObserver(requestMeasure);
  cards.forEach(function(card){contentObserver.observe(card.querySelector('.card__head'));});
  document.fonts.ready.then(requestMeasure);
  reconcile();
})();
