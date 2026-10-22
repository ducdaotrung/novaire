import { createCarouselRuntime } from './carousel-runtime.js';

export const initializeThemeModule = createCarouselRuntime({
  rootSelector: '[data-testimonial-split]',
  slideSelector: '.testimonial-split-slide',
  onInitialize(root, swiper) {
    const syncActiveSlide = () => {
      if (swiper.destroyed) return;
      const active = swiper.slides?.[swiper.activeIndex];
      const focused = document.activeElement;
      const control = focused?.matches?.('[data-carousel-previous]') ? '[data-carousel-previous]'
        : focused?.matches?.('[data-carousel-next]') ? '[data-carousel-next]' : null;
      const moveFocus = control && root.contains(focused) && !active?.contains(focused);
      swiper.slides?.forEach((slide) => {
        const inactive = slide !== active;
        if (slide.hasAttribute('inert') !== inactive) slide.toggleAttribute('inert', inactive);
      });
      if (moveFocus) {
        const next = active?.querySelector(`${control}:not(:disabled)`)
          || active?.querySelector('.testimonial-split-controls__button:not(:disabled)');
        next?.focus({ preventScroll: true });
      }
    };
    syncActiveSlide();
    swiper.on('slideChange update', syncActiveSlide);
    return () => {
      swiper.off('slideChange update', syncActiveSlide);
      swiper.slides?.forEach((slide) => slide.removeAttribute('inert'));
    };
  },
});
