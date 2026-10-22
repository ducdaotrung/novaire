# Shared Swiper carousel

The theme exposes a reusable Swiper rendering and lifecycle contract for
slideshow, featured collection, content list, and product media surfaces.

## Required common Carousel child contract

The common `blocks/carousel.liquid` allows exactly one direct child type:
`slide` from `blocks/slide.liquid`. Keep its schema allow-list as
`"blocks": [{ "type": "slide" }]`. Do not add `@theme`, `@app`, private testimonial
blocks, Gallery items, or Image/Text card items directly to the common Carousel.

All section presets and saved template/group JSON must use the same hierarchy:
`Carousel → Slide → content blocks`. Gallery and Image/Text card content belongs
inside a Slide. Slide owns its existing content allow-list; this rule does not
restrict which compatible content blocks may be nested inside it.

The private Testimonial Carousel remains a separate section-owned contract.
Before changing any common Carousel composition, run
`node --test tests/carousel-shared.test.cjs tests/testimonial-carousel.test.cjs`
and full Theme Check. Do not expand the allow-list to bypass a failing preset;
repair the preset composition while preserving its content.

## Testimonial: split and common Carousel

`sections/testimonial-carousel.liquid` keeps its saved section type but is named
**Testimonial: split**. Split block labels in the editor are **Carousel** and
**Slide**; their stable file/type IDs remain `carousel_split` and `slide_split`.
It allows only `carousel_split` (maximum one). The split
Carousel allows only `slide_split`; each split Slide renders fixed static
`image` and `content` (Group) slots. The Group owns testimonial content.
Desktop uses two equal columns with the image on the right; mobile stacks image
above content. Previous/Next controls remain within the active slide's content. Inactive
slides are inert; navigation focus moves to an enabled control on the newly
active slide, and editor unload restores the slide state.

`testimonial-split.js` initializes only `[data-testimonial-split]` roots. Common
`carousel-block.js` initializes `[data-carousel-block]`. Both use
`carousel-runtime.js` with separate state and editor cleanup. The split supports
one visible slide, Slide/Fade transitions, looping and opt-in autoplay. It does
not use common Carousel pagination or expose extra child types.

The superseded `_testimonial-carousel`, `_testimonial-slide` and their runtime
module are removed. Background and Horizontal testimonial sections retain the
common `carousel` / `slide` contract. `testimonial-item` is still allowed by the
Gallery Header composition and is therefore retained.

For saved JSON using old testimonial block types, run:

```sh
node scripts/migrate-testimonial-carousel.cjs templates/<template>.json
```

The migration converts the old Testimonial Carousel to the split pair, preserves
section/carousel/slide IDs, content, ordering and disabled state, and rehomes each
slide's image and Group in the required static `image`/`content` slots. Static
slot keys necessarily change; nested content IDs stay intact. Unsupported old
carousel settings are removed. Other sections are unchanged except repair of
mistaken split/private types in Background/Horizontal to common blocks. The
migration is idempotent. Migrate remote saved JSON locally before deploying;
this task does not change store data.

## Liquid markup

The common Carousel has Layout, Gap, Size, Navigation, Pagination, Autoplay and
Padding controls. Shared column/navigation/pagination/autoplay labels, choices
follow Product List in Featured Collection when the option exists
in the reference. Navigation/Pagination defaults follow the inspected reference. Existing spacing and pause-on-hover IDs remain stable. Gap
range/default and speed validation follow Product List. The reference retains
one desktop column, Outside/Inside navigation and Primary/Secondary/Outline;
Product List-only Top and Icon only choices are excluded. Desktop/mobile column
counts use the standard 768px breakpoint; custom breakpoint columns are removed.
Preview overflow follows the configured desktop column count. Navigation centering subtracts the
pagination padding/size as in Product List.

Navigation Position, Style, Icon and Behavior are visible only when desktop
navigation is enabled. Pagination Type remains visible regardless of device
switches. Desktop top padding (0–70px) and mobile top padding (0–50px) are visible
only for their enabled device. Progress bar exposes Limit width when either
device is enabled; Max width (100–500px, step 10px) additionally requires Limit
width. Bullets never expose width controls. The width cap applies to both devices.

Slide owns child flow, mobile stacking/alignment, fit/fill height, background
image/video, overlay and blur, border thickness, radius, shadow, a block link,
and desktop/mobile padding. Background videos play only while visible and
pause for reduced motion or a hidden tab. The slide root carries editor attributes;
background/overlay layers are decorative, and nested links and controls stay
interactive above the block link. Theme Editor omits the block-link destination.
Slide Gap ranges from 0–50px; Custom corner radius ranges from 0–40px
(default 20px), and Backdrop blur ranges from 0–100px. Image/Video pickers,
overlay color/blur, color scheme and mobile padding follow their owning switches.
Open link in new tab remains visible even with an empty Link.
Vertical layouts inherit desktop alignment on mobile; a horizontal layout can
stack vertically and set its own mobile alignment without changing its position.

The rebuild uses the observed editor behavior of reference theme 139629002837;
the trial theme does not expose source through Shopify CLI. Common Carousel
excludes transition, loop, fraction controls and all
card-specific settings. Slide excludes border style/color, background color,
custom link-label controls and radius/shadow choices absent from the reference.
Only Inherit/Square/Rounded/Custom radius and None/Extra small/Small shadow remain.
Preset and saved template cleanup removes unsupported settings while retaining
block IDs, child content and order. For older pulled JSON, run:

```sh
node scripts/migrate-common-carousel-options.cjs templates/<template>.json
```

Capture direct `.swiper-slide` items and render the shared viewport:

```liquid
{% capture slides %}
  {% for item in items %}
    <article class="swiper-slide content-card">
      {{ item.title }}
    </article>
  {% endfor %}
{% endcapture %}

{% capture pagination %}
  <div class="swiper-pagination" data-swiper-pagination></div>
{% endcapture %}

{% render 'swiper-carousel',
  id: 'FeaturedContent',
  content: slides,
  root_class: 'content-list__carousel',
  aria_label: 'Featured content',
  pagination: pagination
%}
```

The snippet owns the `.swiper` and `.swiper-wrapper` contract. The caller owns
slide markup, controls, pagination markup, and section-specific styling.
Pass `layout: 'grid'` when the same items should render as a responsive grid;
that mode keeps the markup contract but skips Swiper initialization. Set
`--swiper-carousel-grid-columns` and `--swiper-carousel-grid-gap` from the
owning section or block when using grid mode.
Render `swiper-stylesheet` once in the owning section or layout where the
component is used.

The built-in Product List block and Collection Tab block use the same
`product-collection-grid` renderer. Their `grid` option keeps the existing CSS
grid, while `carousel` adds Swiper slide markup and delegates initialization to
`product-collection-carousel.js`.

Autoplay is an opt-in component contract. Pass `autoplay`, `pause_on_hover`,
and `autoplay_delay` to `swiper-carousel`; it exposes the normalized values as
`data-swiper-autoplay`, `data-swiper-autoplay-pause-on-hover`, and
`data-swiper-autoplay-delay` on the Swiper root. The runtime respects reduced
motion preferences, pauses on hover when configured, and uses the delay in
milliseconds.

Navigation buttons use the shared `swiper-nav-button` class with optional
`swiper-nav-button--prev`, `swiper-nav-button--next`, and
`swiper-nav-button--icon-only` modifiers. The icon-only modifier lets the
button fit its rendered SVG instead of using the default navigation control
size. Global
`--swiper-nav-size`, `--swiper-nav-size-mobile`, and `--swiper-nav-icon-size`
control the button and SVG dimensions. The button radius always follows
`--navigation-radius`, while a component may override these variables on its
carousel root when its navigation needs a different scale.

For shared hover navigation, add `swiper-carousel__container` to the wrapper
that contains the Swiper viewport and navigation, then add
`swiper-carousel__navigation--show_on_hover` to the navigation element. On
hover-capable desktop devices, the shared stylesheet fades the buttons in and
slides them inward by half their configured size; touch layouts keep the
controls available without requiring hover.

Pagination consumes Swiper's `--swiper-pagination-progressbar-size` token for
progress bars. Use pagination-specific custom properties on a component when
its colors or bullet sizing need a local override; keep pagination width and
placement in the owning component. Slideshow and hotspot carousel share
`swiper-pagination--overlay` with `swiper-pagination--desktop-left|center|right`
and `swiper-pagination--mobile-left|center|right` alignment modifiers. The section
provides `--swiper-pagination-inline-padding`; overlay controls use 24px desktop
and 16px mobile bottom spacing. Progress bars span this inset at every alignment.
Add `swiper-pagination--below` when the
pagination should flow below the carousel; it provides shared position,
spacing, width, and centering behavior through `--swiper-pagination-spacing`
and `--swiper-pagination-width`. Use
`swiper-carousel__navigation--centered` for overlay controls that should stay
centered on the slide area when below-flow pagination is present; set
`--swiper-navigation-center-offset` to the pagination flow offset.

Bullet buttons use a 24px height by default. Inactive buttons are 24px wide;
the active button is 48px wide. Override the pagination hit-size and hit-width
custom properties on the pagination root when a component needs different
dimensions. Their width tokens are `--swiper-pagination-bullet-hit-width` and
`--swiper-pagination-bullet-active-hit-width`; height uses
`--swiper-pagination-bullet-hit-size`. The `::before` and `::after` layers own
the visible dot and active indicator through the bullet width/height and
active width/height tokens. Override these tokens on the pagination root
instead of resizing or painting the button itself. The fill inherits the button
radius and reveals through a rounded clip-path, following Essen, so autoplay
does not compress the end radius. RTL reveals from the right; reduced motion
shows the complete fill when autoplay is disabled by reduced motion at startup.
When autoplay is active, Bullets and Progress bar read
`--carousel-autoplay-progress` from the pagination root marked
`data-autoplay-clock`. The shared clock accumulates unpaused time, paints 100%
before navigating, and restarts after manual navigation and transition completion.
The configured delay is the full dwell time after the slide settles. Hover,
keyboard focus, hidden tabs and reduced motion pause both navigation and fill.
Progress bar keeps native slide-position behavior when autoplay is off. Optional placement/spacing
tokens intentionally have consumer fallbacks; they are not missing global
settings.

Pass `show_next_slide_preview: true` to `swiper-carousel` when a desktop
carousel should reveal the next item. The shared contract keeps the numeric
`slidesPerView` value at the configured column count and uses the component
viewport's controlled visual overflow to reveal a 15% preview
(`--swiper-carousel-preview-size`), so the visible items retain their
configured column width. The preview is desktop-only and does not affect grid
layouts or mobile slide counts.

Pass `show_next_slide_preview_on_mobile: true` when a one-column mobile
carousel should reveal the next item. The product/collection carousel runtime
uses `slidesPerView: 1.2` at mobile widths; an explicit two-column mobile
setting remains unchanged.

## JavaScript

Use the shared factory from a section or feature module:

```js
import { Pagination } from './swiper-loader.js';
import { bindSwiperControls, bindSwiperSlideControls, createSwiperCarousel } from './swiper-carousel.js';

const root = document.querySelector('[data-content-list]');
const swiper = createSwiperCarousel(root.querySelector('[data-swiper-carousel]'), {
  modules: [Pagination],
  slidesPerView: 1,
  spaceBetween: 16,
  breakpoints: { 768: { slidesPerView: 3 } },
  pagination: { el: root.querySelector('[data-swiper-pagination]'), clickable: true }
});

bindSwiperControls(swiper, {
  scope: root,
  previous: '[data-swiper-previous]',
  next: '[data-swiper-next]'
});

bindSwiperSlideControls(swiper, {
  scope: root.querySelector('[data-slide-navigation]'),
  selector: '[data-swiper-slide-index]',
  activeClass: 'is-active',
  currentValue: 'step',
  scrollActiveIntoView: true
});
```

`createSwiperCarousel` adds the shared A11y module, enables `watchOverflow`,
deduplicates modules, and is idempotent per element. Use
`destroySwiperCarousel` during section unload or component disconnect. The
factory returns the native Swiper instance so existing product/media behavior
can keep using `slideTo`, `slidePrev`, `slideNext`, `update`, and Swiper events.

`bindSwiperSlideControls` provides a reusable indexed-control contract for
year rails, step navigation, or other controls that target a specific slide.
Each button supplies a numeric `data-swiper-slide-index`; the binder delegates
clicks within the supplied scope, updates an optional active class and
`aria-current`, and returns cleanup for editor unloads. `scrollActiveIntoView`
is opt-in and respects reduced-motion preferences.

## Pagination timeline correction — 2026-10-14

Bullets and Progress bar both consume the same elapsed autoplay clock. Removed
the independent four-second CSS keyframes. JavaScript paints the remaining fill
as a percentage through `--carousel-autoplay-remaining`; LTR and RTL clipping
read that value directly. The fill completes before navigation, resets on slide
change, and pauses with autoplay for hover, focus, hidden tabs and reduced motion.
Timing regression tests cover 1/3/4/7/10 seconds and both CSS timeline consumers.

Live Theme Editor verification was limited by a disconnected Hot Reload preview.
The local fix requires the updated assets to be loaded by the development theme.

## Carousel runtime correction — 2026-10-14

The previous clock still paused for Swiper's 600ms slide transition, producing
approximately 3.6s/7.6s slide intervals for 3s/7s settings. Carousel now counts
transition time within the configured interval; navigation waits if a transition
is still in progress. Logical clone restoration does not restart the clock.
Slideshow retains its existing separate runtime.

Progress bar's inline Swiper transition duration also affected clipping; the
clock-driven fill explicitly disables that transition. Product/Blog/Collection
list carousels now use the shared elapsed-time clock instead of setInterval,
including visibility pause and cleanup when a mobile-only carousel is destroyed.

Runtime measurement with the real bundled Swiper in Chrome: 3s Bullets measured
3029ms and 7s Progress bar measured 7029ms, within two rendering frames; progress
bar's computed transition duration is 0s. Both computed clip values match the
painted remaining percentage. Live Shopify preview verification remains pending.

## Shared Swiper audit — 2026-10-14

Reusable responsibilities now live in `assets/swiper-carousel.js`:

| Responsibility | Shared owner | Consumers |
| --- | --- | --- |
| Instance reuse and destroy cleanup | createSwiperCarousel/destroySwiperCarousel | All Swiper consumers |
| Autoplay clock and pagination fill | bindSwiperAutoplay | Common Carousel and product/collection/blog carousels |
| Navigation and indexed slide controls | bindSwiperControls/bindSwiperSlideControls | Common Carousel, Timeline and composition owners |
| Resize update coalescing | observeSwiperResize | Product/collection/blog carousels and cart drawer recommendations |

Timeline's duplicated slide-control fallback was removed. Resize observation
ignores unchanged dimensions, coalesces bursts into one frame, cancels pending
work on cleanup, and disconnects on direct Swiper destruction. Autoplay rebinding
replaces the previous clock; direct destruction also releases its listeners.
The factory clears its record and controls even when another owner calls native
Swiper.destroy instead of the shared destructor.

All Swiper imports use one entry point, `swiper-loader.js`, exporting A11y,
EffectFade, Pagination, Swiper and Thumbs. Consumers select the exports they need;
the browser caches the module graph. This keeps vendor paths and versions in one
file, following the requested code organization.
Slideshow's runtime behavior, native scrolling in Columns, resource ownership,
and section-specific layout/loop/reveal behavior remain owned by their consumers.

Validation: 28 scoped tests pass; full suite 268/276 passes. The same eight failed
tests also fail against the pre-refactor HEAD snapshot: five promo render tests
cannot resolve a snippet, one scheme render test has a lookup failure, one
quantity-label expectation is stale, and a TCP probe cannot bind inside the
sandbox. No new full-suite failure was introduced. Theme Check: zero errors,
six existing warnings. Browser smoke imports all modified consumers with the
real bundled Swiper and exercises the shared factory, clock and resize helper.
Live Theme Editor replacement/reorder QA remains pending.

The import organization was restored to the centralized loader at user request;
the shared autoplay, resize, slide controls and destroy cleanup refactor remains.

## Shopify CDN module version correction — 2026-10-14

The reported development-theme editor session (139628773461, Carousel
carousel_yKLqNM) logged a real module-link failure: newly versioned consumers
imported unversioned swiper-carousel.js and could not find observeSwiperResize.
This allowed old shared runtime code to coexist with new consumers/styles;
local uncached runtime tests did not cover this deployment behavior.

The head now renders theme-module-import-map before any module script/loader.
Each relative shared dependency and bundled Swiper dependency is remapped from
its unversioned asset URL to the current Shopify asset_url, including its version
query. Source imports and swiper-loader's central exports remain unchanged.
The map is document-scoped: an editor document already holding an old module
requires a fresh preview document to resolve through the new map. Do not reload
an unsaved editor session or save unrelated merchant edits automatically.

Validation includes mapping coverage for all static relative module imports and
shared-only version changes. A browser regression fixture serves the old shared
module at the unversioned URL and the new module at its versioned URL: import
mapping loads the current factory/clock/resize helper, with no console errors.
Bullets measured 3025ms for a 3s setting and its clip matched the remaining clock.
Reference: https://html.spec.whatwg.org/dev/webappapis.html#import-maps
