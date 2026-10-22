const instances = new WeakMap();
const selector = '[data-carousel-slide-video]';

const initialize = (root) => {
  if (instances.has(root)) return;
  const video = root.querySelector('video');
  if (!video) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  const sync = () => {
    if (motion.matches || document.hidden || !visible) video.pause();
    else video.play()?.catch(() => {});
  };
  const observer = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    sync();
  });
  observer.observe(root);
  motion.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  instances.set(root, () => {
    observer.disconnect();
    motion.removeEventListener('change', sync);
    document.removeEventListener('visibilitychange', sync);
    video.pause();
    instances.delete(root);
  });
};

const visit = (root, callback) => {
  if (root.matches?.(selector)) callback(root);
  root.querySelectorAll?.(selector).forEach(callback);
};

export const initializeThemeModule = (root = document) => visit(root, initialize);
document.addEventListener('shopify:section:load', (event) => initializeThemeModule(event.target));
document.addEventListener('shopify:section:unload', (event) => visit(event.target, (root) => instances.get(root)?.()));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initializeThemeModule(), { once: true });
else initializeThemeModule();
