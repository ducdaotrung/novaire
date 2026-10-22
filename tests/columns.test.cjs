const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { migrateColumns } = require('../scripts/migrate-columns.cjs');
const schema = JSON.parse(fs.readFileSync('blocks/columns.liquid', 'utf8').match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
test('Columns exposes the observed settings and conditional editor branches', () => {
  const settings = Object.fromEntries(schema.settings.filter((s) => s.id).map((s) => [s.id, s]));
  assert.deepEqual(Object.keys(settings), ['columns_desktop','columns_mobile','enable_swipe_mobile','gap_horizontal','gap_vertical','gap_horizontal_mobile','gap_vertical_mobile','width','custom_width','padding_top','padding_bottom','customize_mobile_padding','padding_top_mobile','padding_bottom_mobile']);
  assert.deepEqual(settings.columns_desktop.options.map((o) => o.value), ['2','3','4','5','6']);
  assert.deepEqual(settings.columns_mobile.options.map((o) => o.value), ['1','2']);
  assert.equal(settings.gap_vertical_mobile.visible_if, '{{ block.settings.enable_swipe_mobile == false }}');
  assert.equal(settings.custom_width.visible_if, "{{ block.settings.width == 'custom' }}");
  assert.equal(settings.padding_top_mobile.visible_if, '{{ block.settings.customize_mobile_padding }}');
  assert.equal(settings.padding_bottom_mobile.visible_if, '{{ block.settings.customize_mobile_padding }}');
  assert.deepEqual(settings.width.options.map((o) => o.value), ['fill', 'custom']);
  assert.deepEqual([settings.gap_horizontal.max, settings.gap_vertical.max, settings.gap_horizontal_mobile.max, settings.gap_vertical_mobile.max], [100,100,50,50]);
  assert.deepEqual([settings.custom_width.min, settings.custom_width.max], [10,100]);
  assert.deepEqual(schema.blocks, [{type:'_columns-column'}]);
  assert.equal(schema.presets[0].blocks.length, 4);
});
test('legacy Grid migration preserves content, order and disabled state while mapping gaps and removing tablet counts', () => {
  const first = {type:'text',settings:{text:'First'},disabled:true};
  const second = {type:'image',settings:{image:'shopify://image/second.jpg'}};
  const grid = {type:'grid',settings:{columns_desktop:4,columns_tablet:2,columns_mobile:1,custom_columns:true,columns_per_breakpoint:"md:2",gap:64,gap_mobile:24,alignment:'middle'},blocks:{first,second},block_order:['second','first']};
  const document={blocks:{grid}};
  assert.equal(migrateColumns(document),true);
  assert.equal(grid.type,'columns');
  assert.equal(grid.settings.columns_desktop,'4');
  assert.equal(grid.settings.gap_horizontal,64);assert.equal(grid.settings.gap_vertical,64);
  assert.equal(grid.settings.gap_horizontal_mobile,24);assert.equal(grid.settings.gap_vertical_mobile,24);
  assert.equal(grid.settings.columns_per_breakpoint,undefined);
  assert.equal(grid.settings.custom_columns,undefined);
  assert.equal(grid.settings.columns_tablet,undefined);assert.equal(grid.settings.alignment,undefined);
  assert.deepEqual(grid.block_order,['second_column','first_column']);
  assert.equal(grid.blocks.first_column.disabled,true);
  assert.strictEqual(grid.blocks.first_column.blocks.first.blocks.first,first);
  assert.strictEqual(grid.blocks.second_column.blocks.second.blocks.second,second);
  assert.equal(grid.blocks.first_column.blocks.first.settings.position,'center');
  assert.equal(migrateColumns(document),false);
});
test('Grid templates have only Column direct children and valid nested block references', () => {
  const data=JSON.parse(fs.readFileSync('templates/page.about-us.json','utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/,''));
  const visit=(value)=>{
    if(!value||typeof value!=='object')return;
    if(value.type==='columns')for(const child of Object.values(value.blocks||{}))assert.equal(child.type,'_columns-column');
    for(const child of Object.values(value))visit(child);
  };
  visit(data);
});
test('rename keeps saved layout IDs and order synchronized and is idempotent', () => {
  const column={type:'_column',settings:{gap_desktop:24,gap_mobile:16},blocks:{text:{type:'text',settings:{text:'Keep me'}}},block_order:['text']};
  const document={blocks:{story_grid:{type:'grid',settings:{columns_desktop:'2'},blocks:{column},block_order:['column']}},block_order:['story_grid']};
  assert.equal(migrateColumns(document),true);
  assert.deepEqual(document.block_order,['story_columns']);
  assert.equal(document.blocks.story_columns.type,'columns');
  assert.equal(column.type,'_columns-column');
  assert.equal(column.settings.gap_desktop,24);
  assert.equal(column.blocks.text.settings.text,'Keep me');
  assert.equal(migrateColumns(document),false);
});
test('Column exposes all conditional surface and layout branches', () => {
  const source=fs.readFileSync('blocks/_columns-column.liquid','utf8');
  const schema=JSON.parse(source.match(/{% schema %}([\s\S]*?){% endschema %}/)[1]);
  const settings=Object.fromEntries(schema.settings.filter((s)=>s.id).map((s)=>[s.id,s]));
  assert.equal(settings.position.visible_if,"{{ block.settings.direction == 'vertical' and block.settings.height == 'fill' }}");
  assert.equal(settings.alignment_mobile.visible_if,"{{ block.settings.direction == 'horizontal' and block.settings.customize_mobile_alignment }}");
  for(const id of ['background_image','background_image_mobile']) assert.equal(settings[id].visible_if,"{{ block.settings.background_media == 'image' }}");
  assert.equal(settings.background_video.visible_if,"{{ block.settings.background_media == 'video' }}");
  assert.equal(settings.custom_radius.visible_if,"{{ block.settings.corner_radius == 'custom' }}");
  for(const id of ['overlay_color','backdrop_blur']) assert.equal(settings[id].visible_if,'{{ block.settings.show_overlay }}');
  for(const edge of ['top','bottom','left','right']) assert.equal(settings[`padding_${edge}_mobile`].visible_if,'{{ block.settings.customize_mobile_padding }}');
  assert.deepEqual(settings.shadow.options.map((o)=>o.value),['none','extra_small','small','medium','large']);
  assert.equal(settings.width,undefined);
  assert.equal(settings.gap_desktop.default,8);
  assert.equal(settings.gap_mobile.default,8);
  assert.equal((source.match(/block.shopify_attributes/g)||[]).length,1);
  assert.doesNotMatch(source,/swiper-slide|data-carousel/);
});
const path = require('node:path');
const { loadLiquid, stripShopifyMetadata } = require('./helpers/liquid-engine.cjs');
const Liquid = loadLiquid();
const engine = new Liquid({strictFilters:false,fs:{resolve:(_root,file)=>path.resolve('snippets',file+'.liquid'),existsSync:fs.existsSync,readFileSync:(file)=>stripShopifyMetadata(fs.readFileSync(file,'utf8'))}});
engine.registerFilter('t',(value)=>value);
engine.registerFilter('handleize',(value)=>String(value).toLowerCase().replace(/[^a-z0-9_-]/g,'-'));
function renderBlock(file,settings,designMode=false) {
  const source=stripShopifyMetadata(fs.readFileSync(file,'utf8')).replace(/{% content_for 'blocks' %}/g,'{{ children }}');
  return engine.parseAndRenderSync(source,{block:{settings,shopify_attributes:'data-editor-block="column"'},request:{design_mode:designMode},children:'<a href="/child">Child action</a>'});
}
test('rendered Columns applies zero gaps and ignores retired breakpoint settings',()=>{
  const html=renderBlock('blocks/columns.liquid',{gap_horizontal:0,gap_vertical:0,gap_horizontal_mobile:0,gap_vertical_mobile:0,custom_columns:true,columns_per_breakpoint:'xs:2, md:3, md:5, lg:2.5, bad:4, xl:999, xxl:6; color:red'});
  assert.match(html,/class="block-columns"/);
  assert.match(html,/--columns-gap-horizontal: 0px/);
  assert.match(html,/--columns-gap-vertical-mobile: 0px/);
  assert.doesNotMatch(html,/--columns-count-(xs|sm|md|lg|bad|xl|xxl):/);
  const css=fs.readFileSync('blocks/columns.liquid','utf8');
  assert.match(css,/\.block-columns\s*\{/);
  assert.doesNotMatch(css,/\.columns-columns/);
});
test('Column rendering applies fill, custom radius, shadow and independent mobile padding',()=>{
  const html=renderBlock('blocks/_columns-column.liquid',{direction:'horizontal',horizontal_alignment:'space-between',height:'fill',customize_mobile_alignment:true,alignment_mobile:'center',gap_desktop:0,gap_mobile:0,corner_radius:'custom',custom_radius:24,shadow:'large',padding_top:20,customize_mobile_padding:true,padding_top_mobile:0,link:'/details',open_in_new_tab:true});
  assert.match(html,/columns-column--horizontal/);
  assert.match(html,/columns-column--height-fill/);
  assert.match(html,/columns-column--mobile-vertical/);
  assert.match(html,/columns-column--shadow-large/);
  assert.match(html,/--column-custom-radius: 24px/);
  assert.match(html,/--group-gap-desktop: 0px/);
  assert.match(html,/--group-padding-top-mobile: 0px/);
  assert.match(html,/href="\/details"[^>]*target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/<a href="\/child">Child action<\/a>/);
  assert.equal((html.match(/data-editor-block=/g)||[]).length,1);
  const editor=renderBlock('blocks/_columns-column.liquid',{link:'/details'},true);
  assert.doesNotMatch(editor,/href="\/details"/);
});
test('mobile Swiper initializes once, restores desktop grid and cleans up editor lifecycle', () => {
  const vm = require('node:vm');
  const listeners = new Map();
  const media = { matches: true, addEventListener: (_, cb) => listeners.set('media', cb), removeEventListener: () => listeners.delete('media') };
  const motion = { matches: false, addEventListener() {}, removeEventListener() {} };
  const classes = () => { const values = new Set(); return { add: (v) => values.add(v), remove: (v) => values.delete(v), contains: (v) => values.has(v) }; };
  const slide = { classList: classes() };
  const wrapper = { classList: classes(), children: [slide] };
  const events = new Map();
  const root = { matches: () => true, querySelector: () => wrapper, querySelectorAll: () => [], getAttribute: () => 'Columns', addEventListener: (type, cb) => events.set(type, cb), removeEventListener: (type) => events.delete(type) };
  const documentEvents = new Map();
  let creates = 0, destroys = 0, options;
  const context = vm.createContext({
    document: { readyState: 'loading', addEventListener: (type, cb) => documentEvents.set(type, cb) },
    window: { matchMedia: (query) => query.includes('reduced') ? motion : media },
    getComputedStyle: () => ({ getPropertyValue: (key) => key.includes('count') ? '2' : '0px' }),
    createSwiperCarousel: (_, config) => { creates++; options = config; return { slides: [slide], params: config, update() {}, slideNext() {}, slidePrev() {}, slideTo() {} }; },
    destroySwiperCarousel: () => destroys++, observeSwiperResize() {},
  });
  vm.runInContext(fs.readFileSync('assets/columns-swipe.js', 'utf8').replace(/^import .*;\n/gm, '').replace('export const initializeThemeModule', 'globalThis.initializeThemeModule'), context);
  context.initializeThemeModule(root); context.initializeThemeModule(root);
  assert.equal(creates, 1); assert.equal(options.slidesPerView, 2); assert.equal(options.spaceBetween, 0);
  assert.equal(slide.classList.contains('swiper-slide'), true);
  media.matches = false; listeners.get('media')();
  assert.equal(destroys, 1); assert.equal(wrapper.classList.contains('swiper-wrapper'), false);
  assert.equal(slide.classList.contains('swiper-slide'), false);
  media.matches = true; listeners.get('media')(); assert.equal(creates, 2);
  documentEvents.get('shopify:section:unload')({ target: root });
  assert.equal(destroys, 2); assert.equal(events.size, 0); assert.equal(listeners.size, 0);
});
