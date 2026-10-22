#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const commonSections = new Set(['testimonials-background-custom', 'testimonials-horizontal-custom']);
const carouselTypes = new Set(['carousel', '_testimonial-carousel', 'carousel_split']);
const slideTypes = new Set(['slide', '_testimonial-slide', 'testimonial-item', '_slide_split', 'slide_split']);
const definitions = Object.fromEntries(['carousel_split', 'slide_split'].map((type) => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'blocks', `${type}.liquid`), 'utf8');
  return [type, JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]).settings.filter((s) => s.id)];
}));
function normalizeSettings(block) {
  const allowed = new Map(definitions[block.type].map((setting) => [setting.id, setting]));
  for (const [id, value] of Object.entries(block.settings || {})) {
    const setting = allowed.get(id);
    if (!setting) delete block.settings[id];
    else if (setting.options && !setting.options.some((option) => option.value === value)) block.settings[id] = setting.default;
    else if (setting.type === 'range' && typeof value === 'number') block.settings[id] = Math.min(setting.max, Math.max(setting.min, value));
  }
}
function splitSlide(slide) {
  slide.type = 'slide_split';
  slide.settings ||= {};
  slide.settings.position_horizontal ||= slide.settings.position || 'center';
  slide.settings.horizontal_alignment ||= slide.settings.alignment || 'left';
  normalizeSettings(slide);
  if (slide.blocks?.image?.static && slide.blocks?.content?.static) return;
  const children = slide.blocks || {};
  const ordered = [...(slide.block_order || Object.keys(children)), ...Object.keys(children)].filter((id, index, ids) => ids.indexOf(id) === index && children[id]);
  const imageId = ordered.find((id) => children[id].type === 'image');
  const groupId = ordered.find((id) => children[id].type === 'group');
  const image = imageId ? children[imageId] : { type: 'image', settings: { width_desktop: 'fill', width_mobile: 'fill' } };
  const content = groupId ? children[groupId] : { type: 'group', settings: { direction: 'vertical', width: 'fill', appearance_type: 'inherit' }, blocks: {}, block_order: [] };
  content.blocks ||= {};
  content.block_order ||= Object.keys(content.blocks).filter((id) => !content.blocks[id].static);
  for (const id of ordered) if (id !== imageId && id !== groupId) {
    let childId = id;
    while (content.blocks[childId]) childId += '_migrated';
    content.blocks[childId] = children[id];
    if (!children[id].static) content.block_order.push(childId);
  }
  image.static = true; content.static = true;
  slide.blocks = { image, content };
  delete slide.block_order;
}
function migrateTestimonialCarousel(document) {
  const before = JSON.stringify(document);
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (value.type === 'testimonial-carousel' || commonSections.has(value.type)) {
      const split = value.type === 'testimonial-carousel';
      for (const block of Object.values(value.blocks || {})) {
        if (!carouselTypes.has(block.type)) continue;
        block.type = split ? 'carousel_split' : 'carousel';
        if (split) normalizeSettings(block);
        for (const slide of Object.values(block.blocks || {})) {
          if (!slideTypes.has(slide.type)) continue;
          if (split) splitSlide(slide);
          else slide.type = 'slide';
        }
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(document);
  return before !== JSON.stringify(document);
}
function migrateFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const prefix = source.match(/^\s*\/\*[\s\S]*?\*\/\s*/)?.[0] || '';
  const document = JSON.parse(source.slice(prefix.length));
  if (!migrateTestimonialCarousel(document)) return false;
  fs.writeFileSync(file, prefix + JSON.stringify(document, null, 2) + '\n');
  return true;
}
if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('Pass saved template/group JSON files explicitly.');
  for (const file of files) console.log(`${migrateFile(path.resolve(file)) ? 'Migrated' : 'Unchanged'}: ${file}`);
}
module.exports = { migrateTestimonialCarousel, migrateFile };
