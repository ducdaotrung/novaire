const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = (file) => fs.readFileSync(file, 'utf8');
const schema = (file) => JSON.parse(read(file).match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);

test('common schemas expose only the reference settings and choices', () => {
  const expected = {
    carousel: ['columns_desktop', 'columns_mobile', 'show_next_slide_preview_on_desktop', 'show_next_slide_preview_on_mobile', 'gap_desktop', 'gap_mobile', 'width', 'custom_width', 'show_navigation_on_desktop', 'navigation_position', 'navigation_style', 'navigation_icon', 'navigation_behavior', 'pagination_type', 'show_pagination_on_desktop', 'pagination_padding_desktop', 'show_pagination_on_mobile', 'pagination_padding_mobile', 'pagination_limit_width', 'pagination_max_width', 'autoplay', 'pause_on_hover', 'autoplay_speed', 'padding_top', 'padding_bottom', 'customize_mobile_padding', 'padding_top_mobile', 'padding_bottom_mobile'],
    slide: ['direction', 'position', 'position_horizontal', 'horizontal_alignment', 'customize_mobile_alignment', 'alignment', 'alignment_mobile', 'gap_desktop', 'gap_mobile', 'height', 'border_thickness', 'corner_radius', 'custom_radius', 'shadow', 'background_media', 'background_image', 'background_video', 'show_overlay', 'overlay_color', 'backdrop_blur', 'appearance_type', 'color_scheme', 'link', 'open_in_new_tab', 'padding_top', 'padding_bottom', 'padding_left', 'padding_right', 'customize_mobile_padding', 'padding_top_mobile', 'padding_bottom_mobile', 'padding_left_mobile', 'padding_right_mobile'],
  };
  for (const type of Object.keys(expected)) {
    const definition = schema(`blocks/${type}.liquid`);
    assert.deepEqual(definition.settings.filter((s) => s.id).map((s) => s.id).sort(), expected[type].sort());
  }
  assert.deepEqual(schema('blocks/carousel.liquid').blocks, [{ type: 'collection-category' }, { type: 'slide' }]);
  const slide = schema('blocks/slide.liquid');
  assert.deepEqual(slide.settings.find((s) => s.id === 'corner_radius').options.map((o) => o.value), ['inherit', 'square', 'rounded', 'custom']);
  assert.deepEqual(slide.settings.find((s) => s.id === 'shadow').options.map((o) => o.value), ['none', 'extra_small', 'small']);
});

test('cleanup migration removes obsolete common settings without changing private Testimonial or content', () => {
  const { migrateCommonCarouselOptions } = require('../scripts/migrate-common-carousel-options.cjs');
  const content = { type: 'text', settings: { text: 'A review' } };
  const privateBlock = { type: 'carousel_split', settings: { loop: true, controls_style: 'fraction' } };
  const document = { blocks: {
    common: { type: 'carousel', settings: { transition_style: 'fade', custom_columns: true, columns_per_breakpoint: 'md:3', loop: true, controls_style: 'fraction', pagination_max_width: 300, navigation_position: 'top', navigation_style: 'icon_only', gap_desktop: 80 }, blocks: {
      slide: { type: 'slide', settings: { border_type: 'solid', border_color: '#ff0000', background_color: '#000000', corner_radius: 'pill', shadow: 'large', link_label: 'Old label' }, blocks: { content } },
    }, block_order: ['slide'] }, privateBlock,
  } };
  assert.equal(migrateCommonCarouselOptions(document), true);
  assert.deepEqual(document.blocks.common.settings, { pagination_max_width: 300, navigation_position: 'outside', navigation_style: 'primary', gap_desktop: 40 });
  assert.deepEqual(document.blocks.common.blocks.slide.settings, { corner_radius: 'rounded', shadow: 'small', border_thickness: 1 });
  assert.deepEqual(document.blocks.common.block_order, ['slide']);
  assert.strictEqual(document.blocks.common.blocks.slide.blocks.content, content);
  assert.deepEqual(privateBlock.settings, { loop: true, controls_style: 'fraction' });
  assert.equal(migrateCommonCarouselOptions(document), false);
});

test('common Carousel controls match Product list without removing mobile pagination', () => {
  const carousel = schema('blocks/carousel.liquid');
  const product = schema('blocks/product-list.liquid');
  for (const id of ['columns_desktop', 'columns_mobile', 'navigation_position', 'navigation_style', 'navigation_icon', 'navigation_behavior', 'pagination_type', 'autoplay_speed']) {
    const actual = carousel.settings.find((s) => s.id === id);
    const expected = product.settings.find((s) => s.id === id);
    if (id === 'columns_desktop') assert.deepEqual(actual.options.filter((option) => option.value !== '1'), expected.options, id);
    else if (['navigation_position', 'navigation_style'].includes(id)) assert.deepEqual(actual.options, expected.options.filter((option) => !['top', 'icon_only'].includes(option.value)), id);
    else assert.deepEqual([...actual.options || []].sort((a, b) => a.value.localeCompare(b.value)), [...expected.options || []].sort((a, b) => a.value.localeCompare(b.value)), id);
    assert.equal(actual.label, expected.label, id);
    if (['columns_desktop', 'columns_mobile', 'navigation_behavior', 'autoplay_speed'].includes(id)) assert.equal(actual.default, expected.default, id);
  }
  assert.ok(carousel.settings.some((s) => s.id === 'show_pagination_on_mobile'));
  assert.ok(!carousel.settings.some((s) => s.id?.startsWith('image_text_card_')));
});

test('all existing Carousel/Slide presets refer to supported settings and children', () => {
  const schemas = {};
  for (const file of fs.readdirSync('blocks')) if (file.endsWith('.liquid')) schemas[file.slice(0, -7)] = schema(`blocks/${file}`);
  const visit = (block, file) => {
    if (block.type === 'carousel' || block.type === 'slide') {
      const definition = schemas[block.type];
      const settings = new Set(definition.settings.filter((s) => s.id).map((s) => s.id));
      for (const id of Object.keys(block.settings || {})) assert.ok(settings.has(id), `${file}: ${block.type}.${id}`);
      if (block.type === 'carousel') for (const child of Object.values(block.blocks || {})) {
        assert.ok(definition.blocks.some((b) => b.type === child.type), `${file}: ${child.type}`);
      }
    }
    for (const child of Object.values(block.blocks || {})) visit(child, file);
  };
  for (const dir of ['blocks', 'sections']) for (const file of fs.readdirSync(dir)) if (file.endsWith('.liquid')) {
    for (const preset of schema(`${dir}/${file}`).presets || []) for (const block of Object.values(preset.blocks || {})) visit(block, file);
  }
});

test('common Carousel has no custom breakpoint columns or configuration hook', () => {
  assert.equal(fs.existsSync('assets/carousel-columns.js'), false);
  for (const file of ['blocks/carousel.liquid', 'assets/carousel-block.js', 'assets/carousel-runtime.js']) {
    assert.doesNotMatch(read(file), /custom_columns|columns_per_breakpoint|carousel-columns|data-carousel-columns|configureCarouselColumns|configureOptions/, file);
  }
  assert.doesNotMatch(read('locales/en.default.schema.json'), /\"carousel_(?:custom_columns|columns_per_breakpoint)\"/);
});

test('Navigation and Pagination expose the reference controls and conditional widths', () => {
  const settings = Object.fromEntries(schema('blocks/carousel.liquid').settings.filter((s) => s.id).map((s) => [s.id, s]));
  for (const id of ['navigation_position', 'navigation_style', 'navigation_icon', 'navigation_behavior']) {
    assert.equal(settings[id].visible_if, '{{ block.settings.show_navigation_on_desktop }}');
  }
  assert.equal(settings.pagination_type.visible_if, undefined);
  for (const device of ['desktop', 'mobile']) {
    assert.equal(settings[`pagination_padding_${device}`].visible_if, `{{ block.settings.show_pagination_on_${device} }}`);
  }
  assert.equal(settings.pagination_padding_desktop.max, 70);
  assert.equal(settings.pagination_padding_mobile.max, 50);
  assert.deepEqual([settings.pagination_max_width.min, settings.pagination_max_width.max, settings.pagination_max_width.step], [100, 500, 10]);
  // Liquid evaluates logical operators from right to left, unlike JavaScript.
  const evaluate = (expression, values) => {
    const tokens = expression.replace(/^{{\s*|\s*}}$/g, '').split(/ (and|or) /);
    const atom = (token) => {
      const [key, value] = token.replace('block.settings.', '').split(' == ');
      return value ? values[key] === value.slice(1, -1) : Boolean(values[key]);
    };
    let result = atom(tokens.pop());
    while (tokens.length) {
      const op = tokens.pop();
      const left = atom(tokens.pop());
      result = op === 'and' ? left && result : left || result;
    }
    return result;
  };
  for (const type of ['progress_bar', 'bullets']) for (const desktop of [false, true]) for (const mobile of [false, true]) for (const limit of [false, true]) {
    const values = { pagination_type: type, show_pagination_on_desktop: desktop, show_pagination_on_mobile: mobile, pagination_limit_width: limit };
    const visible = type === 'progress_bar' && (desktop || mobile);
    assert.equal(evaluate(settings.pagination_limit_width.visible_if, values), visible, JSON.stringify(values));
    assert.equal(evaluate(settings.pagination_max_width.visible_if, values), visible && limit, JSON.stringify(values));
  }
});

test('Slide background video pauses for reduced motion and cleans up on editor unload', () => {
  const events = new Map();
  const motionListeners = new Set();
  const observers = [];
  let plays = 0;
  let pauses = 0;
  const video = { play() { plays++; return Promise.resolve(); }, pause() { pauses++; } };
  const root = { matches: (s) => s === '[data-carousel-slide-video]', querySelector: () => video, querySelectorAll: () => [] };
  const motion = { matches: false, addEventListener: (_, fn) => motionListeners.add(fn), removeEventListener: (_, fn) => motionListeners.delete(fn) };
  const document = {
    hidden: false, readyState: 'loading', querySelectorAll: () => [root],
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener: (name, fn) => events.get(name)?.delete(fn),
  };
  const context = vm.createContext({ document, window: { matchMedia: () => motion },
    IntersectionObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
  });
  vm.runInContext(read('assets/carousel-slide.js').replace('export const initializeThemeModule', 'globalThis.initializeThemeModule'), context);
  context.initializeThemeModule(); context.initializeThemeModule();
  assert.equal(observers.length, 1);
  assert.equal(plays, 0);
  observers[0].fn([{ isIntersecting: true }]);
  assert.equal(plays, 1);
  motion.matches = true; motionListeners.forEach((fn) => fn());
  assert.equal(pauses, 1);
  events.get('shopify:section:unload').forEach((fn) => fn({ target: root }));
  assert.equal(observers[0].disconnected, true);
  assert.equal(motionListeners.size, 0);
  assert.equal(events.get('visibilitychange').size, 0);
  context.initializeThemeModule();
  assert.equal(observers.length, 2);
});


test('Slide conditional settings cover every reference layout and appearance branch', () => {
  const settings = Object.fromEntries(schema('blocks/slide.liquid').settings.filter((s) => s.id).map((s) => [s.id, s]));
  const rules = {
    alignment: "{{ block.settings.direction == 'vertical' }}",
    position: "{{ block.settings.direction == 'vertical' and block.settings.height == 'fill' }}",
    position_horizontal: "{{ block.settings.direction == 'horizontal' }}",
    horizontal_alignment: "{{ block.settings.direction == 'horizontal' }}",
    customize_mobile_alignment: "{{ block.settings.direction == 'horizontal' }}",
    alignment_mobile: "{{ block.settings.direction == 'horizontal' and block.settings.customize_mobile_alignment }}",
    custom_radius: "{{ block.settings.corner_radius == 'custom' }}",
    background_image: "{{ block.settings.background_media == 'image' }}",
    background_video: "{{ block.settings.background_media == 'video' }}",
    overlay_color: '{{ block.settings.show_overlay }}',
    backdrop_blur: '{{ block.settings.show_overlay }}',
    color_scheme: "{{ block.settings.appearance_type == 'scheme' }}",
  };
  for (const edge of ['top', 'bottom', 'left', 'right']) rules[`padding_${edge}_mobile`] = '{{ block.settings.customize_mobile_padding }}';
  for (const [id, rule] of Object.entries(rules)) assert.equal(settings[id].visible_if, rule, id);
  assert.equal(settings.open_in_new_tab.visible_if, undefined);
  assert.deepEqual([settings.gap_desktop.max, settings.gap_mobile.max], [50, 50]);
  assert.deepEqual([settings.custom_radius.min, settings.custom_radius.max, settings.custom_radius.default], [0, 40, 20]);
  assert.equal(settings.backdrop_blur.max, 100);
});
