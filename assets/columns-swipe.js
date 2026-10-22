import { createSwiperCarousel, destroySwiperCarousel, observeSwiperResize } from './swiper-carousel.js';

const selector = '[data-columns-swipe]';
const instances = new WeakMap();
const visit = (root, callback) => {
  if (root.matches?.(selector)) callback(root);
  root.querySelectorAll?.(selector).forEach(callback);
};

const initialize = (root) => {
  if (instances.has(root)) return;
  const wrapper = root.querySelector(':scope > .columns-swipe-wrapper');
  if (!wrapper) return;
  const mobile = window.matchMedia('(max-width: 767.98px)');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let swiper = null;
  const stop = () => {
    if (swiper) destroySwiperCarousel(swiper);
    swiper = null;
    wrapper.classList.remove('swiper-wrapper');
    for (const slide of wrapper.children) slide.classList.remove('swiper-slide');
  };
  const sync = () => {
    if (!mobile.matches) return stop();
    if (swiper && !swiper.destroyed) return swiper.update();
    wrapper.classList.add('swiper-wrapper');
    for (const slide of wrapper.children) slide.classList.add('swiper-slide');
    const styles = getComputedStyle(root);
    swiper = createSwiperCarousel(root, {
      slidesPerView: Number(styles.getPropertyValue('--columns-count-mobile')) || 1,
      spaceBetween: parseFloat(styles.getPropertyValue('--columns-gap-horizontal-mobile')) || 0,
      speed: motion.matches ? 0 : 300,
      resizeObserver: false,
      a11y: { containerMessage: root.getAttribute('aria-label') },
    });
    observeSwiperResize(swiper);
  };
  const keydown = (event) => {
    if (!swiper || event.target !== root || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = (event.key === 'ArrowRight') !== swiper.rtlTranslate;
    next ? swiper.slideNext() : swiper.slidePrev();
  };
  const reducedMotion = () => { if (swiper) swiper.params.speed = motion.matches ? 0 : 300; };
  mobile.addEventListener('change', sync);
  motion.addEventListener('change', reducedMotion);
  root.addEventListener('keydown', keydown);
  instances.set(root, { sync, getSwiper: () => swiper, destroy() {
    stop();
    mobile.removeEventListener('change', sync);
    motion.removeEventListener('change', reducedMotion);
    root.removeEventListener('keydown', keydown);
    instances.delete(root);
  } });
  sync();
};

export const initializeThemeModule = (root = document) => visit(root, initialize);
document.addEventListener('shopify:section:load', (event) => initializeThemeModule(event.target));
document.addEventListener('shopify:section:unload', (event) => visit(event.target, (root) => instances.get(root)?.destroy()));
document.addEventListener('shopify:section:select', (event) => visit(event.target, (root) => {
  initialize(root);
  instances.get(root)?.sync();
}));
document.addEventListener('shopify:block:select', (event) => {
  const root = event.target.closest?.(selector);
  if (!root) return;
  initialize(root);
  const swiper = instances.get(root)?.getSwiper();
  const slide = event.target.closest('.columns-column');
  const index = swiper ? Array.from(swiper.slides).indexOf(slide) : -1;
  if (index >= 0) swiper.slideTo(index, 0);
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeThemeModule(), { once: true });
else initializeThemeModule();
