import { createCarouselRuntime } from './carousel-runtime.js';

export const initializeThemeModule = createCarouselRuntime({
  rootSelector: '[data-carousel-block]',
  slideSelector: '.carousel-slide, .editorial-category, .press-item, .product-callout',
  onInitialize(root, swiper) {
    if (root.dataset.carouselPreviewRequested !== 'true') return;
    const viewport = root.querySelector('[data-swiper-carousel]');
    const syncPreview = () => {
      if (swiper.destroyed || !viewport) return;
      const count = swiper.slides.filter((slide) => !slide.classList.contains('swiper-slide-duplicate')).length;
      viewport.dataset.swiperNextSlidePreview = String(count > Number(swiper.params.slidesPerView));
    };
    syncPreview();
    swiper.on('breakpoint resize update', syncPreview);
    return () => swiper.off('breakpoint resize update', syncPreview);
  },
});
