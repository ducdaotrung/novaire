import { Pagination } from './swiper-loader.js';
import { createSwiperCarousel, destroySwiperCarousel, observeSwiperResize } from './swiper-carousel.js';

const carouselSelector = '[data-cart-drawer-recommendation-list]';
const instances = new WeakMap();

const getSlides = (carousel) => {
  const wrapper = carousel.querySelector(':scope > .swiper-wrapper');
  return Array.from(wrapper?.children || []);
};

const destroy = (carousel) => {
  const instance = instances.get(carousel);
  if (!instance) return;

  instance.resizeCleanup?.();
  destroySwiperCarousel(carousel);
  instances.delete(carousel);
};

const initialize = (carousel) => {
  const recommendations = carousel.closest('[data-cart-drawer-recommendations]');
  if (!recommendations || recommendations.hidden || !getSlides(carousel).length) return;

  const existing = instances.get(carousel);
  if (existing?.swiper && !existing.swiper.destroyed) {
    existing.swiper.update();
    existing.swiper.pagination?.render();
    existing.swiper.pagination?.update();
    return;
  }

  const pagination = recommendations.querySelector('[data-cart-drawer-recommendation-pagination]');
  const swiper = createSwiperCarousel(carousel, {
    modules: [Pagination],
    slidesPerView: 1,
    spaceBetween: 0,
    observer: true,
    observeParents: true,
    pagination: pagination ? {
      el: pagination,
      type: 'bullets',
      clickable: true,
    } : undefined,
  });
  if (!swiper) return;

  const resizeCleanup = observeSwiperResize(swiper, carousel);
  instances.set(carousel, { swiper, resizeCleanup });
};

const initializeRoot = (root = document) => {
  if (root.matches?.(carouselSelector)) initialize(root);
  root.querySelectorAll?.(carouselSelector).forEach(initialize);
};

const scheduleInitialize = (root) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => initializeRoot(root));
  });
};

const destroyRoot = (root) => {
  const carousels = [];
  if (root.matches?.(carouselSelector)) carousels.push(root);
  root.querySelectorAll?.(carouselSelector).forEach((carousel) => carousels.push(carousel));
  carousels.forEach(destroy);
};

document.addEventListener('cart:updated', (event) => {
  scheduleInitialize(event.detail?.drawer || document.querySelector('[data-cart-drawer]'));
});

document.addEventListener('cart-drawer:open', (event) => {
  scheduleInitialize(event.detail?.drawer || document.querySelector('[data-cart-drawer]'));
});

document.addEventListener('shopify:section:load', (event) => scheduleInitialize(event.target));
document.addEventListener('shopify:section:select', (event) => scheduleInitialize(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
} else {
  initializeRoot();
}
