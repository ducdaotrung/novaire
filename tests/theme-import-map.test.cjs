const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadLiquid,stripShopifyMetadata}=require('./helpers/liquid-engine.cjs');
const Liquid=loadLiquid();
const source=stripShopifyMetadata(fs.readFileSync('snippets/theme-module-import-map.liquid','utf8'));
function render(version){const engine=new Liquid();engine.registerFilter('asset_url',(file)=>`//cdn.shopify.com/s/files/test/t/7/assets/${file}?v=${file==='swiper-carousel.js'?version:'unchanged'}`);return JSON.parse(engine.parseAndRenderSync(source).match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]);}
test('relative module dependencies resolve to versioned Shopify assets before scripts load',()=>{
 const map=render('new-shared-version').imports;
 for(const file of fs.readdirSync('assets').filter((file)=>/\.(js|mjs)$/.test(file))){
  const code=fs.readFileSync(`assets/${file}`,'utf8');
  for(const [,dependency]of code.matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+)['"]/g)) {
   const key=`//cdn.shopify.com/s/files/test/t/7/assets/${dependency}`;
   assert.ok(map[key],`${file} imports unmapped ${dependency}`);
   assert.ok(map[key].includes('?v='));
  }
 }
 const layout=fs.readFileSync('layout/theme.liquid','utf8');
 assert.ok(layout.indexOf("render 'theme-module-import-map'")<layout.indexOf("'theme-module-loader.js' | asset_url"));
 assert.ok(layout.indexOf("render 'theme-module-import-map'")<layout.indexOf('type="module"'));
});
test('updating only the shared module changes its mapping without changing the consumer URL',()=>{
 const oldMap=render('old').imports;const newMap=render('new').imports;
 const key='//cdn.shopify.com/s/files/test/t/7/assets/swiper-carousel.js';
 assert.equal(oldMap[key],key+'?v=old');assert.equal(newMap[key],key+'?v=new');
 const loader='//cdn.shopify.com/s/files/test/t/7/assets/swiper-loader.js';
 assert.equal(oldMap[loader],newMap[loader]);
});
