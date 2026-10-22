const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { migrateFeaturedCollectionBanner } = require('../scripts/migrate-featured-collection-banner.cjs');

test('banner migration preserves merchant content, IDs, nested static card and saved order', () => {
  const source = { sections: { banner: { type: 'featured-collection-banner', settings: { banner_position: 'after' }, blocks: {
    header: { type: 'header', static: true, settings: { text: 'Merchant heading' }, disabled: true },
    banner: { type: 'banner', static: true, settings: { image: 'shopify://image.jpg' }, blocks: { text: { type: 'text', settings: { text: 'Saved copy' } } }, block_order: ['text'] },
    products: { type: 'product-list-banner', static: true, settings: { collection: 'news' }, blocks: { card: { type: 'product-card', static: true, settings: { color_scheme: 'scheme-4' } } } }
  } } } };
  const before = structuredClone(source);
  assert.equal(migrateFeaturedCollectionBanner(source), true);
  const section = source.sections.banner;
  assert.deepEqual(section.block_order, ['header', 'banner', 'products']);
  assert.equal(section.blocks.products.blocks.card.static, true);
  for (const id of section.block_order) {
    const expected = before.sections.banner.blocks[id];
    delete expected.static;
    assert.deepEqual(section.blocks[id], expected);
  }
  assert.equal(migrateFeaturedCollectionBanner(source), false);
  section.block_order = ['products', 'header', 'banner'];
  assert.equal(migrateFeaturedCollectionBanner(source), false);
  assert.deepEqual(section.block_order, ['products', 'header', 'banner']);
});

test('banner offers the same three dynamic roles and keeps nested product-card static', () => {
  const source = fs.readFileSync('sections/featured-collection-banner.liquid', 'utf8');
  const schema = JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  assert.equal(schema.max_blocks, 3);
  assert.deepEqual(schema.blocks.map((block) => block.type), ['header', 'banner', 'product-list-banner']);
  assert.match(source, /{% content_for 'blocks' %}/);
  for (const role of schema.presets[0].blocks) assert.equal(role.static, undefined);
  assert.equal(schema.presets[0].blocks[2].blocks[0].static, true);
});

test('View all is a fixed Product list child linked to its selected collection', () => {
  const productListSource = fs.readFileSync('blocks/product-list-banner.liquid', 'utf8');
  const viewAllSource = fs.readFileSync('blocks/featured-banner-view-all.liquid', 'utf8');
  const productListSchema = JSON.parse(productListSource.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  const homepageSource = fs.readFileSync('templates/index.json', 'utf8');
  const homepage = JSON.parse(homepageSource.slice(homepageSource.indexOf('{')));
  const savedSection = Object.values(homepage.sections).find((section) => section.type === 'featured-collection-banner');
  const savedProductList = Object.values(savedSection.blocks).find((block) => block.type === 'product-list-banner');

  assert.match(productListSource, /content_for 'block', type: 'featured-banner-view-all', id: 'view-all', closest\.collection: product_list_banner_collection/);
  assert.match(viewAllSource, /closest\.collection\.url \| default: routes\.all_products_collection_url/);
  assert.equal(productListSchema.presets[0].blocks.find((block) => block.id === 'view-all').static, true);
  assert.equal(savedProductList.blocks['view-all'].type, 'featured-banner-view-all');
  assert.equal(savedProductList.blocks['view-all'].static, true);
});
