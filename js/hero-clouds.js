/** Animation visibility only. The SVG geometry is baked at build time and
 * scales with its CSS artboard; no runtime layout measurements. */
const stage = document.querySelector('.hero__inner');
const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const testMode = local ? new URLSearchParams(location.search).get('clouds') : null;
if (stage) {
  stage.classList.add(testMode === 'still' || testMode === 'fallback' ? 'clouds-still' : 'clouds-live');
  let onScreen = true;
  const pause = () => stage.classList.toggle('clouds-paused', document.hidden || !onScreen);
  new IntersectionObserver(entries => {
    onScreen = entries[0].isIntersecting;
    pause();
  }).observe(stage);
  document.addEventListener('visibilitychange', pause);
}
