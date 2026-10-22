const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const engine = new (loadLiquid())({
  fs: {
    resolve: (_root, file) => path.resolve('snippets', `${file}.liquid`),
    exists: async () => true,
    readFile: async (file) => stripShopifyMetadata(fs.readFileSync(file, 'utf8')),
  },
});

test('heading Display follows the semantic tag while explicit sizes remain independent', async () => {
  const source = stripShopifyMetadata(fs.readFileSync('blocks/heading.liquid', 'utf8'));
  for (const [tag, size] of Object.entries({ h1: 'display', h2: 'xl', h3: 'lg', h4: 'md', h5: 'sm', h6: 'xs', div: 'xl' })) {
    const html = await engine.parseAndRender(source, { block: { settings: { text: '<p>Title</p>', html_tag: tag, heading_size: 'display' } } });
    assert.match(html, new RegExp(`<${tag}[^>]*heading-${size}`));
  }
  const custom = await engine.parseAndRender(source, { block: { settings: { text: 'Title', heading_size: 'custom', custom_heading_size: 37 } } });
  assert.match(custom, /--heading-block-custom-size: 37px/);
});

test('text and eyebrow custom sizes reach rendered CSS variables', async () => {
  for (const [name, setting] of [['text', 'text_size'], ['eyebrow', 'font_size']]) {
    const source = stripShopifyMetadata(fs.readFileSync(`blocks/${name}.liquid`, 'utf8'));
    const html = await engine.parseAndRender(source, { block: { settings: { text: '<p>Label</p>', [setting]: 'custom', custom_font_size: 31 } } });
    assert.match(html, new RegExp(`--${name}-custom-font-size: 31px`));
    assert.match(html, /<p>Label<\/p>/);
  }
});

test('all semantic heading settings expose three breakpoints and eyebrow spacing accepts tenths', () => {
  const schema = JSON.parse(fs.readFileSync('config/settings_schema.json', 'utf8'));
  const settings = schema.flatMap((group) => group.settings || []);
  for (let i = 1; i <= 6; i++) {
    for (const device of ['desktop', 'tablet', 'mobile']) {
      assert.ok(settings.some((setting) => setting.id === `type_heading_${i}_size_${device}`));
    }
  }
  const spacing = settings.find((setting) => setting.id === 'type_eyebrow_letter_spacing_px');
  assert.equal(spacing.step, 0.1);
  assert.ok((spacing.max - spacing.min) / spacing.step <= 100);
});
