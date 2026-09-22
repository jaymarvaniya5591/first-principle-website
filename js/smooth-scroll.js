/* Lenis 1.3.26, locally served. Desktop wheel input gets a damped response;
   touch, reduced motion and narrow layouts retain ordinary browser scrolling. */
(function () {
  'use strict';
  var desktop = matchMedia('(min-width:1100px) and (prefers-reduced-motion:no-preference)');
  var instance = null;
  var listeners = [];
  var navigationDone = null;

  function finishNavigation() {
    var done = navigationDone;
    navigationDone = null;
    if (done) done();
  }
  function reconcile() {
    if (!desktop.matches || !window.Lenis) {
      finishNavigation();
      if (instance) instance.destroy();
      instance = null;
      return;
    }
    if (instance) return;
    instance = new Lenis({
      autoRaf: true,
      lerp: .085,
      wheelMultiplier: .82,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
      // Form controls and independent scrollers keep their own input.
      prevent: function (node) {
        return node.matches('textarea,select,[contenteditable="true"],.mobile-menu,[data-lenis-prevent]');
      },
      virtualScroll: function (input) {
        if (input.event.type !== 'wheel' || input.event.ctrlKey) return;
        finishNavigation();
        var amount = Math.abs(input.deltaY);
        var direction = Math.sign(input.deltaY);
        // A soft knee trims large impulses without changing fine movements.
        if (amount > 80) input.deltaY = direction * (80 + (amount - 80) / (1 + (amount - 80) / 160));
        // Reverse from the position actually on screen, rather than continuing
        // towards a stale forward target while the user is already scrolling up.
        var ahead = instance.targetScroll - instance.animatedScroll;
        if (amount > 1 && Math.abs(ahead) > 1 && direction !== Math.sign(ahead)) {
          instance.scrollTo(instance.actualScroll, { immediate: true });
        }
      }
    });
    instance.on('scroll', function () { listeners.forEach(function (render) { render(); }); });
  }
  window.siteScroll = {
    get active() { return !!instance; },
    onFrame: function (render) { listeners.push(render); },
    to: function (target, done) {
      if (!instance) return false;
      finishNavigation();
      navigationDone = done || null;
      instance.scrollTo(target, {
        duration: 1.05,
        easing: function (t) { return 1 - Math.pow(1 - t, 4); },
        onComplete: finishNavigation
      });
      return true;
    }
  };
  // Keyboard and scrollbar input must be able to interrupt an anchor journey.
  window.addEventListener('keydown', function (event) {
    if (!instance || !['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) return;
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    finishNavigation();
    instance.scrollTo(instance.actualScroll, { immediate: true });
  });
  window.addEventListener('pointerdown', function (event) {
    if (!instance || event.clientX < document.documentElement.clientWidth) return;
    finishNavigation();
    instance.scrollTo(instance.actualScroll, { immediate: true });
  });
  desktop.addEventListener('change', reconcile);
  reconcile();
})();
