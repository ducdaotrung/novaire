const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function runtime() {
  const frames=new Map();let id=0;let observer;
  class ResizeObserver { constructor(callback){this.callback=callback;observer=this;} observe(){} disconnect(){this.disconnected=true;} }
  class Swiper { constructor(el){this.el=el;this.events=new Map();} on(event,callback){const set=this.events.get(event)||new Set();set.add(callback);this.events.set(event,set);} off(event,callback){this.events.get(event)?.delete(callback);} destroy(){for(const callback of [...this.events.get('destroy')||[]])callback();this.destroyed=true;} update(){this.updates=(this.updates||0)+1;} }
  const ctx=vm.createContext({Swiper,A11y:{},ResizeObserver,window:{requestAnimationFrame:(callback)=>{frames.set(++id,callback);return id;},cancelAnimationFrame:(id)=>frames.delete(id)},document:{}});
  vm.runInContext(fs.readFileSync('assets/swiper-carousel.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export const (\w+) =/gm,'globalThis.$1 ='),ctx);
  return {ctx,frames,get observer(){return observer;},flush(){for(const [id,callback] of [...frames]){frames.delete(id);callback();}}};
}
test('resize updates coalesce, ignore repeated sizes and stop on destroy',()=>{
  const h=runtime();const element={nodeType:1,matches(){return false;},dataset:{},clientWidth:500,clientHeight:200};
  const swiper=h.ctx.createSwiperCarousel(element);
  const cleanup=h.ctx.observeSwiperResize(swiper,element);
  const resize=(width,height)=>h.observer.callback([{contentRect:{width,height}}]);
  resize(500,200);resize(501,200);resize(502,200);
  assert.equal(h.frames.size,1);h.flush();assert.equal(swiper.updates,1);
  resize(502,200);assert.equal(h.frames.size,0);
  resize(503,200);swiper.destroy();
  assert.equal(h.frames.size,0);assert.equal(h.observer.disconnected,true);
  cleanup();resize(504,200);assert.equal(h.frames.size,0);
  assert.equal(element.dataset.swiperReady,undefined);
  assert.equal(h.ctx.getSwiperCarousel(element),null);
});
test('factory reuses an active instance and creates a new instance after direct destruction',()=>{
  const h=runtime();const element={nodeType:1,matches(){return false;},dataset:{}};
  const first=h.ctx.createSwiperCarousel(element);
  assert.strictEqual(h.ctx.createSwiperCarousel(element),first);
  first.destroy();
  const second=h.ctx.createSwiperCarousel(element);
  assert.notStrictEqual(second,first);
  h.ctx.destroySwiperCarousel(second);
  assert.equal(second.destroyed,true);
  assert.equal(element.dataset.swiperReady,undefined);
});
