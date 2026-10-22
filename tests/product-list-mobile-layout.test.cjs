const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(mode, matches) {
  let source = fs.readFileSync('assets/product-collection-carousel.js', 'utf8')
    .replace(/^import .*;\r?$/gm, '')
    .replace(/^export .*;\r?$/gm, '');
  const query = { matches, addEventListener(_, handler) { this.handler = handler; }, removeEventListener() { this.removed = true; } };
  const scope = { closest: () => null, matches: () => false, querySelector: () => null };
  const carousel = { dataset: { [mode]: 'true' }, closest: () => scope, querySelector: () => null };
  const calls = { create: 0, destroy: 0, resizeCleanup: 0 };
  const context = {
    Pagination: {},
    createSwiperCarousel() { calls.create++; return {}; },
    destroySwiperCarousel() { calls.destroy++; },
    observeSwiperResize: () => () => calls.resizeCleanup++,
    bindSwiperAutoplay: () => () => {},
    window: { matchMedia: () => query },
    document: { readyState: 'loading', addEventListener() {} },
  };
  vm.runInNewContext(source + '\nglobalThis.api = { initialize, destroy };', context);
  return { ...context.api, carousel, query, calls };
}

for (const mode of ['swiperMobileOnly', 'swiperDesktopOnly']) {
  test(`${mode}: initialize only on selected device, resize safely, clean up on unload`, () => {
    const h = harness(mode, false);
    h.initialize(h.carousel);
    assert.equal(h.calls.create, 0);
    h.query.matches = true;
    h.query.handler();
    assert.equal(h.calls.create, 1);
    h.initialize(h.carousel);
    assert.equal(h.calls.create, 1);
    h.query.matches = false;
    h.query.handler();
    assert.equal(h.calls.destroy, 1);
    assert.equal(h.calls.resizeCleanup, 1);
    h.query.matches = true;
    h.query.handler();
    assert.equal(h.calls.create, 2);
    h.destroy(h.carousel);
    assert.equal(h.calls.destroy, 2);
    assert.equal(h.query.removed, true);
  });
}
