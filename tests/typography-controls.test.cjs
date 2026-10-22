const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({ fs: {
  resolve: (_root, file) => path.resolve('snippets', `${file}.liquid`),
  exists: async () => true,
  readFile: async file => stripShopifyMetadata(fs.readFileSync(file, 'utf8')),
} });
engine.registerFilter('font_modify', (font, key, value) => {
  assert.equal(typeof value, 'string', 'Shopify font_modify only accepts string arguments');
  return { ...font, [key]: value };
});
engine.registerFilter('font_face', font => font ? `@font-face { font-weight: ${font.weight}; }` : '');
const source = fs.readFileSync('snippets/css-variables.liquid', 'utf8')
  .replace(/{%\s*style\s*%}/g, '<style>').replace(/{%\s*endstyle\s*%}/g, '</style>');

test('reference typography reaches global CSS, including tablet line height and the real font variant', async () => {
  const html = await engine.parseAndRender(source, { settings: { type_heading_font: { weight: 400 } } });
  assert.match(html, /--font-heading-weight: 300;/);
  assert.match(html, /@font-face \{ font-weight: 300; \}/);
  assert.match(html, /--font-body-line-height: 21px;/);
  for (const [token, height, spacing] of [
    ['display', 1.3, 3.6], ['xl', 1.4, 2.56], ['lg', 1.5, 2.24],
    ['md', 1.6, 1.44], ['sm', 1.5, 1.28], ['xs', 1.5, 0],
  ]) {
    assert.ok(html.includes(`--font-heading-${token}-line-height: ${height};`));
    assert.ok(html.includes(`--font-heading-${token}-letter-spacing: ${spacing}px;`));
  }
  assert.ok(!html.includes('--font-heading-xl-line-height: 1.3;'));
});

test('merchant overrides retain fractional spacing, explicit zero and custom line height', async () => {
  const html = await engine.parseAndRender(source, { settings: {
    type_heading_weight: 500, type_body_line_height_px: 25,
    type_heading_1_letter_spacing_px: '0', type_heading_2_letter_spacing_px: '2.57',
    type_heading_1_line_height_percent: 175,
  } });
  assert.match(html, /--font-heading-weight: 500;/);
  assert.match(html, /--font-body-line-height: 25px;/);
  assert.match(html, /--font-heading-display-letter-spacing: 0px;/);
  assert.match(html, /--font-heading-xl-letter-spacing: 2.57px;/);
  assert.match(html, /--font-heading-display-line-height: 1.75;/);
});
