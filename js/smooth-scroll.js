/* Lenis 1.3.26, locally served. Desktop wheel input gets a damped response;
   touch, reduced motion and narrow layouts retain ordinary browser scrolling. */
(function () {
  'use strict';
  var desktop = matchMedia('(min-width:1100px) and (prefers-reduced-motion:no-preference)');
  var instance = null;
  var listeners = [];
  var navigationDone = null;
  var navigationActive = false;

  // Quintic easing keeps velocity AND acceleration continuous, including at
  // both endpoints. A split quadratic changes acceleration abruptly mid-trip.
  function navigationEase(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function navigationDuration(distance) {
    var screens = distance / Math.max(1, window.innerHeight || 720);
    return Math.min(1.5, .6 + .25 * Math.sqrt(screens));
  }

  function finishNavigation() {
    navigationActive = false;
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
        // The technology panel already routed this input between its two scrollers.
        if (input.event.defaultPrevented) return false;
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
    cancel: function () {
      finishNavigation();
      if (instance) {
        // Initial fragment navigation can follow a growing Why-us runway before
        // Lenis's debounced observer refreshes its limit. Sync it before clamping.
        instance.resize();
        instance.scrollTo(instance.actualScroll, { immediate: true });
      }
    },
    // Delta is already normalized by the caller. Keep one owner of page inertia.
    by: function (delta) {
      finishNavigation();
      if (!instance) {
        window.scrollBy({ top: delta, behavior: 'instant' });
        return;
      }
      var ahead = instance.targetScroll - instance.animatedScroll;
      if (Math.abs(ahead) > 1 && Math.sign(delta) !== Math.sign(ahead)) {
        instance.scrollTo(instance.actualScroll, { immediate: true });
      }
      instance.scrollTo(instance.targetScroll + delta, { lerp: .18 });
    },
    to: function (target, done, options) {
      if (!instance) return false;
      finishNavigation();
      // Links clicked just after load need the same fresh document limit.
      instance.resize();
      var start = instance.actualScroll;
      target = Math.max(0, Math.min(target, instance.limit));
      navigationDone = done || null;
      navigationActive = true;
      if (Math.abs(target - start) < 1) {
        instance.scrollTo(target, { immediate:true });
        finishNavigation();
        return true;
      }
      // A held sticky scene has no visual travel within its reading runway.
      // Map across that interval instead of making visitors wait on a still frame.
      var cut = options && options.cut;
      var low = cut ? Math.max(Math.min(start, target), cut[0]) : 0;
      var high = cut ? Math.min(Math.max(start, target), cut[1]) : 0;
      var skipped = Math.max(0, high - low);
      var totalDistance = Math.abs(target - start);
      var distance = totalDistance - skipped;
      var duration = navigationDuration(distance);
      var easing = navigationEase;
      if (skipped > 0) {
        var direction = target >= start ? 1 : -1;
        var before = direction > 0 ? low - start : start - high;
        // Keep Lenis in charge for the entire journey. Repeated immediate
        // scrollTo calls reset its native-scroll bookkeeping every frame.
        easing = function (progress) {
          var travelled = distance * navigationEase(progress);
          return (travelled + (travelled >= before ? skipped : 0)) / totalDistance;
        };
      }
      instance.scrollTo(target, {
        duration: duration,
        easing: easing,
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
  window.addEventListener('touchstart', function () { window.siteScroll.cancel(); }, { passive:true });
  window.addEventListener('resize', function () {
    if (navigationActive) window.siteScroll.cancel();
  }, { passive:true });
  desktop.addEventListener('change', reconcile);
  reconcile();
})();
