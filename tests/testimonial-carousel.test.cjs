const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { migrateTestimonialCarousel } = require('../scripts/migrate-testimonial-carousel.cjs');
const read = (file) => fs.readFileSync(file, 'utf8');
const schema = (file) => JSON.parse(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);

test('testimonial migration rehomes legacy content into static split slots and preserves carousel order', () => {
  const image = { type: 'image', settings: { image: 'shopify://image/review.jpg' } };
  const quote = { type: 'text', settings: { text: 'Review' } };
  const carousel = { type: '_testimonial-carousel', settings: { loop: true, controls_style: 'fraction' }, blocks: {
    slideA: { type: '_testimonial-slide', settings: { gap_desktop: 36 }, blocks: { quote }, block_order: ['quote'] },
    itemB: { type: 'testimonial-item', blocks: { photo: image, copy: { type: 'group', blocks: { quote }, block_order: ['quote'] } } },
  }, block_order: ['itemB', 'slideA'], disabled: true };
  const other = { type: 'carousel', blocks: { regular: { type: 'slide' } } };
  const document = { sections: {
    reviews: { type: 'testimonial-carousel', blocks: { carousel } },
    gallery: { type: 'gallery-carousel', blocks: { normal: structuredClone(other) } },
  } };
  assert.equal(migrateTestimonialCarousel(document), true);
  assert.equal(carousel.type, 'carousel_split');
  assert.deepEqual(carousel.settings, { loop: true });
  assert.deepEqual(carousel.block_order, ['itemB', 'slideA']);
  assert.equal(carousel.disabled, true);
  for (const slide of Object.values(carousel.blocks)) {
    assert.equal(slide.type, 'slide_split');
    assert.deepEqual(Object.keys(slide.blocks), ['image', 'content']);
    assert.equal(slide.blocks.image.static, true);
    assert.equal(slide.blocks.content.static, true);
    assert.deepEqual(slide.blocks.content.blocks.quote, quote);
    assert.deepEqual(slide.blocks.content.block_order, ['quote']);
    assert.equal(slide.block_order, undefined);
  }
  assert.equal(carousel.blocks.itemB.blocks.image.settings.image, image.settings.image);
  assert.deepEqual(document.sections.gallery.blocks.normal, other);
  assert.equal(migrateTestimonialCarousel(document), false);
});

test('split composition uses exact child slots and obsolete private blocks are removed', () => {
  const section = schema('sections/testimonial-carousel.liquid');
  assert.equal(section.name, 'Testimonial: split');
  assert.equal(section.max_blocks, 1);
  assert.deepEqual(section.blocks, [{ type: 'carousel_split' }]);
  assert.deepEqual(schema('blocks/carousel_split.liquid').blocks, [{ type: 'slide_split' }]);
  assert.deepEqual(schema('blocks/slide_split.liquid').blocks, [{ type: 'image' }, { type: 'group' }]);
  for (const file of ['blocks/_testimonial-carousel.liquid', 'blocks/_testimonial-slide.liquid', 'assets/testimonial-carousel.js']) assert.equal(fs.existsSync(file), false);
  const source = read('blocks/slide_split.liquid');
  assert.match(source, /content_for 'block', type: 'image', id: 'image'/);
  assert.match(source, /content_for 'block', type: 'group', id: 'content'/);
  assert.match(source, /data-carousel-previous/);
  assert.match(source, /data-carousel-next/);
  for (const carousel of section.presets[0].blocks) for (const slide of carousel.blocks) {
    assert.equal(slide.type, 'slide_split');
    assert.deepEqual(slide.blocks.map((b) => [b.id, b.static]), [['image', true], ['content', true]]);
  }
});

test('Background and Horizontal recover mistakenly assigned private carousel types', () => {
  const text = { type: 'text', settings: { text: 'Keep this review' } };
  const privateBlock = { type: '_testimonial-carousel', settings: { columns_desktop: '1' }, blocks: {
    slideA: { type: '_testimonial-slide', settings: { alignment: 'center' }, blocks: { text } },
  }, block_order: ['slideA'] };
  for (const type of ['testimonials-background-custom', 'testimonials-horizontal-custom']) {
    const document = { sections: { review: { type, blocks: { carouselA: structuredClone(privateBlock) }, block_order: ['carouselA'] } } };
    assert.equal(migrateTestimonialCarousel(document), true);
    const carousel = document.sections.review.blocks.carouselA;
    assert.equal(carousel.type, 'carousel');
    assert.equal(carousel.blocks.slideA.type, 'slide');
    assert.deepEqual(carousel.settings, privateBlock.settings);
    assert.deepEqual(carousel.blocks.slideA.blocks.text, text);
    assert.deepEqual(carousel.block_order, ['slideA']);
    assert.deepEqual(document.sections.review.block_order, ['carouselA']);
    assert.equal(migrateTestimonialCarousel(document), false);
  }
});

test('reported testimonial presets resolve every referenced block from repository files', () => {
  const visit = (block, parent, file) => {
    assert.ok(fs.existsSync(`blocks/${block.type}.liquid`), `${file}: undefined block type ${block.type}`);
    const allowed = parent.blocks || [];
    assert.ok(allowed.some((entry) => entry.type === block.type)
      || (!block.type.startsWith('_') && allowed.some((entry) => entry.type === '@theme')), `${file}: disallowed ${block.type}`);
    const definition = schema(`blocks/${block.type}.liquid`);
    for (const child of Object.values(block.blocks || {})) visit(child, definition, file);
  };
  for (const name of ['testimonial-carousel', 'testimonials-background-custom', 'testimonials-horizontal-custom']) {
    const file = `sections/${name}.liquid`;
    const definition = schema(file);
    if (name !== 'testimonial-carousel') assert.ok(!read(file).includes('_testimonial-'), file);
    for (const preset of definition.presets) for (const block of Object.values(preset.blocks || {})) visit(block, definition, file);
  }
});

test('generic and testimonial modules initialize and unload independently without duplicate listeners', () => {
  const events = new Map();
  const resize = new Set();
  const creations = [];
  const makeRoot = (selector) => {
    const wrapper = { children: [{ classList: { contains: () => true } }] };
    const viewport = { dataset: {}, querySelector: (s) => s === '.swiper-wrapper' ? wrapper : null };
    return {
      selector, dataset: {}, classList: { toggle() {} }, style: { setProperty(key, value) { this[key] = value; } },
      matches: (s) => s === selector, hasAttribute: () => false, querySelectorAll: () => [],
      querySelector: (s) => s === '[data-swiper-carousel]' ? viewport : s === '.testimonial-item' && selector === '[data-testimonial-split]' ? {} : null,
    };
  };
  const normal = makeRoot('[data-carousel-block]');
  const testimonial = makeRoot('[data-testimonial-split]');
  const document = {
    readyState: 'loading', querySelectorAll: (selector) => [normal, testimonial].filter((root) => root.matches(selector)),
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, []); events.get(name).push(fn); },
  };
  const context = vm.createContext({ document, window: {
    addEventListener: (name, fn) => resize.add(fn), removeEventListener: (name, fn) => resize.delete(fn),
    getComputedStyle: () => ({ getPropertyValue: () => '36' }),
  }, EffectFade: {}, Pagination: {},
  createSwiperCarousel(viewport) {
    const swiper = { destroyed: false, isLocked: false, params: {}, on() {}, off() {}, update() { this.updates = (this.updates || 0) + 1; } };
    creations.push(swiper); return swiper;
  }, destroySwiperCarousel(swiper) { swiper.destroyed = true; },
  });
  let runtime = read('assets/carousel-runtime.js').replace(/^import .*;\n/gm, '').replace('export const createCarouselRuntime', 'globalThis.createCarouselRuntime');
  vm.runInContext(runtime, context);
  for (const [file, binding] of [['carousel-block', 'normalInit'], ['testimonial-split', 'testimonialInit']]) {
    const source = read(`assets/${file}.js`).replace(/^import .*;\n/gm, '').replace('export const initializeThemeModule', `globalThis.${binding}`);
    vm.runInContext(source, context);
  }
  context.normalInit(document);
  assert.equal(creations.length, 1);
  assert.equal(resize.size, 0);
  context.testimonialInit(document);
  assert.equal(creations.length, 2);
  assert.equal(resize.size, 0);
  context.normalInit(document); context.testimonialInit(document);
  assert.equal(creations.length, 2);
  const fire = (name, target) => events.get(name).forEach((fn) => fn({ target }));
  fire('shopify:section:select', testimonial);
  assert.equal(creations[1].updates, 1);
  assert.equal(creations[0].updates, undefined);
  fire('shopify:section:unload', testimonial);
  assert.equal(creations[1].destroyed, true);
  assert.equal(creations[0].destroyed, false);
  assert.equal(resize.size, 0);
  fire('shopify:section:load', testimonial);
  assert.equal(creations.length, 3);
  assert.equal(resize.size, 0);
});

test('split runtime makes inactive slides inert and transfers navigation focus', () => {
  let config;
  let focused = 0;
  const focusedControl = { matches: (selector) => selector === '[data-carousel-next]' };
  const slides = [0, 1].map((index) => ({
    inert: false,
    hasAttribute() { return this.inert; },
    contains: (element) => index === 0 && element === focusedControl,
    toggleAttribute(name, enabled) { this.inert = enabled; },
    removeAttribute() { this.inert = false; },
    querySelector: () => ({ focus: () => focused++ }),
  }));
  const listeners = new Map();
  const swiper = { slides, activeIndex: 0, on: (name, fn) => listeners.set(name, fn), off: (name) => listeners.delete(name) };
  const context = vm.createContext({ document: { activeElement: focusedControl }, createCarouselRuntime: (options) => { config = options; } });
  vm.runInContext(read('assets/testimonial-split.js').replace(/^import .*;\n/gm, '').replace('export const initializeThemeModule', 'globalThis.initializeThemeModule'), context);
  const cleanup = config.onInitialize({ contains: () => true }, swiper);
  assert.deepEqual(slides.map((s) => s.inert), [false, true]);
  assert.equal(focused, 0);
  swiper.activeIndex = 1;
  listeners.get('slideChange update')();
  assert.deepEqual(slides.map((s) => s.inert), [true, false]);
  assert.equal(focused, 1);
  cleanup();
  assert.deepEqual(slides.map((s) => s.inert), [false, false]);
  assert.equal(listeners.size, 0);
});
