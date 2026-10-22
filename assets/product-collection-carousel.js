import { Pagination } from './swiper-loader.js';
import { bindSwiperAutoplay, createSwiperCarousel, destroySwiperCarousel, observeSwiperResize } from './swiper-carousel.js';

const instances = new WeakMap();
const carouselSelector = '[data-product-carousel][data-layout="carousel"]';
const desktopBreakpoint = 768;

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const getCarouselScope = (carousel) =>
  carousel.closest('[data-product-list], [data-blog-list], [data-collection-tab-carousel], [data-collection-card-list]') ||
  carousel.parentElement ||
  carousel;

const getSlidesPerView = (value) => {
  const slidesPerView = Math.min(6, toNumber(value, 1));
  return Math.max(1, Math.floor(slidesPerView));
};

const getMobileSlidesPerView = (carousel) => {
  const columns = getSlidesPerView(carousel.dataset.swiperColumnsMobile);

  if (carousel.dataset.swiperNextSlidePreviewMobile === 'true') {
    return columns + 0.2;
  }

  return columns;
};

const getPaginationType = (value) => (value === 'progress_bar' ? 'progressbar' : 'bullets');

const getControls = (carousel, scope) => {
  const previousSelector = carousel.dataset.swiperPreviousSelector;
  const nextSelector = carousel.dataset.swiperNextSelector;
  if (!previousSelector && !nextSelector) return null;

  return {
    scope,
    previous: previousSelector,
    next: nextSelector,
  };
};

const getFirstDataValue = (elements, key) => {
  for (const element of elements) {
    const value = element?.dataset?.[key];
    if (value !== undefined && value !== '') return value;
  }

  return null;
};

const buildOptions = (carousel, scope) => {
  const pagination =
    carousel.querySelector('[data-product-collection-pagination]') ||
    carousel.querySelector('[data-swiper-pagination]');
  const paginationType = getPaginationType(pagination?.dataset.paginationType || carousel.dataset.swiperPaginationType);
  const options = {
    ...(carousel.closest('[data-product-list]') ? { breakpointsBase: 'container' } : {}),
    slidesPerView: getMobileSlidesPerView(carousel),
    spaceBetween: toNumber(carousel.dataset.swiperGapMobile, 0),
    breakpoints: {
      [desktopBreakpoint]: {
        slidesPerView: getSlidesPerView(carousel.dataset.swiperColumnsDesktop),
        spaceBetween: toNumber(carousel.dataset.swiperGapDesktop, 0),
      },
    },
    controls: getControls(carousel, scope),
  };

  if (pagination) {
    options.modules = [Pagination];
    options.pagination = {
      el: pagination,
      type: paginationType,
      clickable: paginationType === 'bullets',
    };
  }

  return options;
};

const getAutoplaySettings = (carousel, scope) => {
  const section = scope.closest('[data-collection-tabs]');
  const settingsSources = [carousel, scope, section];
  const autoplay = getFirstDataValue(settingsSources, 'swiperAutoplay');
  const pauseOnHover = getFirstDataValue(settingsSources, 'swiperAutoplayPauseOnHover');
  const delay = getFirstDataValue(settingsSources, 'swiperAutoplayDelay');
  const legacyAutoplay =
    scope.matches('[data-collection-tab-carousel]') &&
    scope.dataset.autoplay === 'true' &&
    section?.dataset.autoplay === 'true';

  return {
    enabled: (autoplay === null ? legacyAutoplay : autoplay === 'true') && !prefersReducedMotion(),
    pauseOnHover: pauseOnHover !== 'false',
    delay: Math.min(60000, Math.max(1000, toNumber(delay, 4000))),
  };
};

const isVisible = (element) => element.getClientRects().length > 0;

const startAutoplay = (state) => {
  const autoplay = getAutoplaySettings(state.carousel, state.scope);
  if (!autoplay.enabled) return;

  state.autoplayCleanup = bindSwiperAutoplay(state.swiper, {
    ...autoplay,
    scope: state.scope,
    isVisible: () => isVisible(state.carousel),
  });
};

const observeVisibility = (state) => {
  const panel = state.carousel.closest('[data-collection-tab-panel]');
  if (!panel || typeof MutationObserver === 'undefined') return;

  state.visibilityObserver = new MutationObserver(() => {
    if (!panel.hidden) window.requestAnimationFrame(() => {
      state.swiper.update();
      updateNavigationPosition(state);
    });
  });
  state.visibilityObserver.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
};

const updateNavigationPosition = (state) => {
  const navigation = state.scope.querySelector('[data-collection-carousel-navigation]');
  const media = state.carousel.querySelector('.product-card__media');
  if (!navigation || !media) return;
  const mediaRect = media.getBoundingClientRect();
  const containerRect = navigation.offsetParent?.getBoundingClientRect();
  if (!containerRect || mediaRect.height === 0) return;
  navigation.style.setProperty('--collection-tab-navigation-image-center', `${mediaRect.top - containerRect.top + mediaRect.height / 2}px`);
};

const observeNavigationPosition = (state) => {
  const media = state.carousel.querySelector('.product-card__media');
  if (!media || !state.scope.querySelector('[data-collection-carousel-navigation]')) return;
  updateNavigationPosition(state);
  if (typeof ResizeObserver === 'undefined') return;
  state.mediaResizeObserver = new ResizeObserver(() => updateNavigationPosition(state));
  state.mediaResizeObserver.observe(media);
};

const initialize = (carousel) => {
  if (!carousel || instances.has(carousel)) return;

  const scope = getCarouselScope(carousel);
  const isProductList = Boolean(carousel.closest('[data-product-list]'));
  const state = {
    carousel,
    scope,
    swiper: null,
    autoplayCleanup: null,
    resizeCleanup: null,
    visibilityObserver: null,
    mediaResizeObserver: null,
    mobileQuery: null,
    mobileQueryHandler: null,
    containerResizeObserver: null,
  };
  instances.set(carousel, state);

  if (carousel.dataset.swiperMobileOnly === 'true' || carousel.dataset.swiperDesktopOnly === 'true') {
    state.mobileQuery = window.matchMedia(carousel.dataset.swiperDesktopOnly === 'true'
      ? `(min-width: ${desktopBreakpoint}px)`
      : `(max-width: ${desktopBreakpoint - 0.02}px)`);
    state.mobileQueryHandler = () => {
      const containerWidth = carousel.clientWidth;
      const useMobileLayout = isProductList && state.containerResizeObserver
        ? containerWidth > 0 && containerWidth < desktopBreakpoint
        : state.mobileQuery.matches;
      if (useMobileLayout) {
        if (!state.swiper) {
          state.swiper = createSwiperCarousel(carousel, buildOptions(carousel, scope));
          if (state.swiper) {
            startAutoplay(state);
            state.resizeCleanup = observeSwiperResize(state.swiper, carousel);
          }
        }
      } else if (state.swiper) {
        state.resizeCleanup?.();
        state.resizeCleanup = null;
        state.autoplayCleanup?.();
        state.autoplayCleanup = null;
        destroySwiperCarousel(state.swiper);
        state.swiper = null;
      }
    };
    if (isProductList && typeof ResizeObserver !== 'undefined') {
      state.containerResizeObserver = new ResizeObserver(state.mobileQueryHandler);
      state.containerResizeObserver.observe(carousel);
    } else {
      state.mobileQuery.addEventListener('change', state.mobileQueryHandler);
    }
    state.mobileQueryHandler();
    return;
  }

  const swiper = createSwiperCarousel(carousel, buildOptions(carousel, scope));
  if (!swiper) {
    instances.delete(carousel);
    return;
  }
  state.swiper = swiper;
  startAutoplay(state);
  state.resizeCleanup = observeSwiperResize(swiper, carousel);
  observeVisibility(state);
  observeNavigationPosition(state);
};

const initializeRoot = (root = document) => {
  if (root.matches?.(carouselSelector)) initialize(root);
  root.querySelectorAll?.(carouselSelector).forEach(initialize);
};

export { initializeRoot as initializeThemeModule };

const destroy = (carousel) => {
  const state = instances.get(carousel);
  if (!state) return;

  state.autoplayCleanup?.();
  state.resizeCleanup?.();
  state.visibilityObserver?.disconnect();
  state.mediaResizeObserver?.disconnect();
  state.containerResizeObserver?.disconnect();
  state.mobileQuery?.removeEventListener('change', state.mobileQueryHandler);
  if (state.swiper) destroySwiperCarousel(state.swiper);
  instances.delete(carousel);
};

const destroyRoot = (root) => {
  const carousels = [];
  if (root.matches?.(carouselSelector)) carousels.push(root);
  root.querySelectorAll?.(carouselSelector).forEach((carousel) => carousels.push(carousel));
  carousels.forEach(destroy);
};

document.addEventListener('shopify:section:load', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:select', (event) => initializeRoot(event.target));
document.addEventListener('shopify:section:unload', (event) => destroyRoot(event.target));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initializeRoot(), { once: true });
} else {
  initializeRoot();
}
