import { A11y, Swiper } from './swiper-loader.js';

const instances = new WeakMap();
const autoplayBindings = new WeakMap();
const CONTROL_EVENTS = ['afterInit', 'fromEdge', 'lock', 'resize', 'slideChange', 'toEdge', 'unlock', 'update'];

const isElement = (value) => value?.nodeType === 1 && typeof value.matches === 'function';

const resolveElements = (target, scope) => {
  if (!target) return [];
  if (isElement(target)) return [target];
  if (typeof target === 'string') return Array.from(scope?.querySelectorAll(target) || []);
  if (Array.isArray(target)) return target.flatMap((item) => resolveElements(item, scope));
  if (typeof target.length === 'number') return Array.from(target).filter(isElement);
  return [];
};

const uniqueModules = (modules) => Array.from(new Set([A11y, ...modules].filter(Boolean)));

const buildSwiperOptions = (options) => {
  const { modules = [], ...swiperOptions } = options;
  const normalizedModules = Array.isArray(modules) ? modules : [modules];

  return {
    modules: uniqueModules(normalizedModules),
    watchOverflow: true,
    ...swiperOptions,
    a11y: {
      enabled: true,
      ...(swiperOptions.a11y || {})
    }
  };
};

const setControlState = (control, disabled, locked = false) => {
  if ('disabled' in control) control.disabled = disabled;
  control.setAttribute('aria-disabled', String(disabled));
  control.classList.toggle('swiper-button-disabled', disabled && !locked);
  control.classList.toggle('swiper-button-lock', locked);
};

const getSwiperFromTarget = (target) => {
  if (!target) return null;
  if (target.el) return target;
  if (isElement(target)) return instances.get(target)?.swiper || target.swiper || null;
  return null;
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** One elapsed-time clock owns autoplay navigation and pagination progress. */
export const bindSwiperAutoplay = (swiper, settings = {}) => {
  if (swiper) autoplayBindings.get(swiper)?.();
  if (!swiper || swiper.destroyed || prefersReducedMotion()) return () => {};

  const delay = Math.min(60000, Math.max(1000, Number(settings.delay) || 4000));
  const scope = settings.scope || swiper.el;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const pagination = swiper.el?.querySelector('.swiper-pagination');
  const previousClock = pagination?.getAttribute('data-autoplay-clock');
  const previousProgress = pagination?.style.getPropertyValue('--carousel-autoplay-progress');
  const previousRemaining = pagination?.style.getPropertyValue('--carousel-autoplay-remaining');
  let elapsed = 0;
  let lastTime = null;
  let pendingAdvance = false;
  let frame;
  let stopped = false;
  let paintedProgress = null;
  let currentIndex = settings.getIndex?.();
  const paint = (progress, paused) => {
    if (!pagination) return;
    const state = paused ? 'paused' : 'running';
    if (pagination.dataset.autoplayClock !== state) pagination.dataset.autoplayClock = state;
    const value = String(progress);
    if (paintedProgress !== value) {
      pagination.style.setProperty('--carousel-autoplay-progress', value);
      pagination.style.setProperty('--carousel-autoplay-remaining', `${(1 - progress) * 100}%`);
      paintedProgress = value;
    }
  };
  const reset = () => {
    if (settings.getIndex) {
      const index = settings.getIndex();
      if (index === currentIndex) return;
      currentIndex = index;
    }
    elapsed = 0;
    lastTime = null;
    pendingAdvance = false;
    paint(0, Boolean(swiper.animating));
  };
  const resetTime = () => { lastTime = null; };
  const tick = (time) => {
    if (stopped || swiper.destroyed) return;
    const delta = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;
    const paused = document.hidden || motion?.matches || swiper.isLocked || settings.isVisible?.() === false
      || (settings.pauseOnHover !== false && swiper.wrapperEl?.matches(':hover'))
      || scope.contains(document.activeElement);
    if (paused) paint(elapsed / delay, true);
    else if (pendingAdvance && !swiper.animating) {
      // The completed fill was painted on the preceding frame before navigation.
      pendingAdvance = false;
      swiper.isEnd ? swiper.slideTo(0) : swiper.slideNext();
    } else {
      elapsed = Math.min(delay, elapsed + delta);
      paint(elapsed / delay, false);
      pendingAdvance = elapsed === delay;
    }
    frame = window.requestAnimationFrame(tick);
  };
  swiper.on('slideChange', reset);
  document.addEventListener('visibilitychange', resetTime);
  paint(0, true);
  frame = window.requestAnimationFrame(tick);
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    window.cancelAnimationFrame(frame);
    swiper.off('slideChange', reset);
    swiper.off('destroy', cleanup);
    autoplayBindings.delete(swiper);
    document.removeEventListener('visibilitychange', resetTime);
    if (pagination) {
      if (previousClock === null) pagination.removeAttribute('data-autoplay-clock');
      else pagination.setAttribute('data-autoplay-clock', previousClock);
      if (previousProgress) pagination.style.setProperty('--carousel-autoplay-progress', previousProgress);
      else pagination.style.removeProperty('--carousel-autoplay-progress');
      if (previousRemaining) pagination.style.setProperty('--carousel-autoplay-remaining', previousRemaining);
      else pagination.style.removeProperty('--carousel-autoplay-remaining');
    }
  };
  autoplayBindings.set(swiper, cleanup);
  swiper.on('destroy', cleanup);
  return cleanup;
};

/** Coalesce size changes and release the observer when Swiper is destroyed. */
export const observeSwiperResize = (swiper, element = swiper?.el) => {
  if (!swiper || swiper.destroyed || !element || typeof ResizeObserver === 'undefined') return () => {};
  let previousWidth = 0;
  let previousHeight = 0;
  let frame = null;
  let stopped = false;
  const observer = new ResizeObserver(([entry]) => {
    const width = Math.round(entry?.contentRect?.width || element.clientWidth);
    const height = Math.round(entry?.contentRect?.height || element.clientHeight);
    if (stopped || swiper.destroyed || !width || (width === previousWidth && height === previousHeight)) return;
    previousWidth = width;
    previousHeight = height;
    if (frame !== null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      if (!stopped && !swiper.destroyed) swiper.update();
    });
  });
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
    if (frame !== null) window.cancelAnimationFrame(frame);
    swiper.off('destroy', cleanup);
  };
  observer.observe(element);
  swiper.on('destroy', cleanup);
  return cleanup;
};

export const bindSwiperControls = (swiper, controls = {}) => {
  if (!swiper || swiper.destroyed) return () => {};

  const controlOptions = controls && controls !== true ? controls : {};
  const scope = controlOptions.scope || swiper.el;
  const previousControls = resolveElements(
    controlOptions.previous || '[data-swiper-previous]',
    scope,
  );
  const nextControls = resolveElements(controlOptions.next || '[data-swiper-next]', scope);
  if (!previousControls.length && !nextControls.length) return () => {};

  const controller = new AbortController();
  const eventOptions = { signal: controller.signal };
  const update = () => {
    if (swiper.destroyed) return;

    const isLocked = Boolean(swiper.isLocked);
    const isLooping = Boolean(swiper.params.loop || controlOptions.loop);
    const previousDisabled = isLocked || (!isLooping && swiper.isBeginning);
    const nextDisabled = isLocked || (!isLooping && swiper.isEnd);

    previousControls.forEach((control) => {
      setControlState(control, previousDisabled, isLocked);
      if (swiper.el.id) control.setAttribute('aria-controls', swiper.el.id);
    });
    nextControls.forEach((control) => {
      setControlState(control, nextDisabled, isLocked);
      if (swiper.el.id) control.setAttribute('aria-controls', swiper.el.id);
    });
  };

  previousControls.forEach((control) => {
    control.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') return;
      swiper.slidePrev();
    }, eventOptions);
  });
  nextControls.forEach((control) => {
    control.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') return;
      swiper.slideNext();
    }, eventOptions);
  });

  CONTROL_EVENTS.forEach((eventName) => {
    swiper.on(eventName, update);
  });

  update();
  return () => {
    controller.abort();
    CONTROL_EVENTS.forEach((eventName) => {
      swiper.off(eventName, update);
    });
  };
};

/**
 * Binds a scoped set of buttons to individual Swiper slides. The caller owns
 * the button markup and supplies each target index through a data attribute.
 */
export const bindSwiperSlideControls = (swiper, controls = {}) => {
  if (!swiper || swiper.destroyed) return () => {};

  const controlOptions = controls && controls !== true ? controls : {};
  const scope = controlOptions.scope || swiper.el;
  const selector = controlOptions.selector || '[data-swiper-slide-index]';
  const indexAttribute = controlOptions.indexAttribute || 'data-swiper-slide-index';
  const activeClass = controlOptions.activeClass || 'is-active';
  const currentValue = controlOptions.currentValue || 'true';
  const scrollActiveIntoView = Boolean(controlOptions.scrollActiveIntoView);
  const controller = new AbortController();
  let previousActiveIndex = null;

  const getControls = () => Array.from(scope.querySelectorAll(selector));
  const getControlIndex = (control) => {
    const value = control.getAttribute(indexAttribute);
    return value === null ? Number.NaN : Number(value);
  };
  const update = () => {
    if (swiper.destroyed) return;

    const activeIndex = Number.isInteger(swiper.realIndex) ? swiper.realIndex : swiper.activeIndex;
    const activeControl = getControls().find((control) => getControlIndex(control) === activeIndex);
    getControls().forEach((control) => {
      const isActive = control === activeControl;
      if (activeClass) control.classList.toggle(activeClass, isActive);
      if (isActive) control.setAttribute('aria-current', currentValue);
      else control.removeAttribute('aria-current');
    });

    if (scrollActiveIntoView && activeControl && previousActiveIndex !== null && activeIndex !== previousActiveIndex) {
      activeControl.scrollIntoView?.({
        block: 'nearest',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    previousActiveIndex = activeIndex;
  };

  scope.addEventListener('click', (event) => {
    const control = event.target.closest?.(selector);
    if (!control || !scope.contains(control)) return;

    const index = getControlIndex(control);
    if (!Number.isInteger(index) || index < 0 || index >= swiper.slides.length) return;
    event.preventDefault();
    if (index !== swiper.realIndex) {
      if (swiper.params.loop && typeof swiper.slideToLoop === 'function') {
        swiper.slideToLoop(index, swiper.params.speed);
      } else {
        swiper.slideTo(index, swiper.params.speed);
      }
    }
  }, { signal: controller.signal });

  const updateEvents = ['activeIndexChange', 'slideChangeTransitionEnd', 'slidesUpdated', 'update'];
  updateEvents.forEach((eventName) => swiper.on(eventName, update));
  update();

  return () => {
    controller.abort();
    updateEvents.forEach((eventName) => swiper.off(eventName, update));
  };
};

export const createSwiperCarousel = (element, options = {}) => {
  if (!isElement(element) || element.dataset.swiperLayout === 'grid') return null;

  const existing = getSwiperFromTarget(element);
  if (existing && !existing.destroyed) return existing;

  const { controls, ...swiperOptions } = options;
  const swiper = new Swiper(element, buildSwiperOptions(swiperOptions));
  const controlsCleanup = controls ? bindSwiperControls(swiper, controls) : null;
  let released = false;
  const cleanup = () => {
    if (released) return;
    released = true;
    controlsCleanup?.();
    autoplayBindings.get(swiper)?.();
    instances.delete(element);
    delete element.dataset.swiperReady;
  };
  swiper.on('destroy', cleanup);
  instances.set(element, { cleanup, swiper });
  element.dataset.swiperReady = 'true';
  return swiper;
};

export const updateSwiperCarousel = (target) => {
  const swiper = getSwiperFromTarget(target);
  if (!swiper || swiper.destroyed) return null;
  swiper.update();
  return swiper;
};

export const destroySwiperCarousel = (target, deleteInstance = true, cleanupStyles = true) => {
  const element = target?.el || (isElement(target) ? target : null);
  const record = element ? instances.get(element) : null;
  const swiper = record?.swiper || getSwiperFromTarget(target);

  record?.cleanup?.();
  if (swiper && !swiper.destroyed) swiper.destroy(deleteInstance, cleanupStyles);
  if (element) {
    delete element.dataset.swiperReady;
    instances.delete(element);
  }

  return null;
};

export const getSwiperCarousel = getSwiperFromTarget;
