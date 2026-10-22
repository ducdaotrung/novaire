# Columns block contract

`blocks/columns.liquid` uses the `columns` type ID and displays **Columns**.
It allows only the dedicated `_columns-column` kernel as direct children. Columns owns
column counts, column spacing, desktop width, mobile swipe and vertical padding;
Column owns content flow and presentation. Do not reintroduce tablet/alignment
or left/right padding controls to the parent.

The Columns settings are desktop 2–6 (default 4), mobile 1–2 (default 1),
mobile swipe, horizontal/vertical gaps, desktop Fill/Custom width and top/bottom
padding with mobile overrides. Custom width appears only for Custom; vertical
mobile gap is hidden while swipe is enabled; mobile padding appears only under
Custom for mobile. Desktop gaps range 0–100px; mobile gaps 0–50px;
custom width 10–100% (default 50%).

Mobile column counts apply below 768px; desktop counts apply from 768px onward.

Mobile swipe uses the shared Swiper factory with touch/drag and keyboard focus,
without a scrollbar or pagination. Swiper is destroyed from 768px onward, restoring
the desktop grid. Without JavaScript, the mobile layout remains a grid. Desktop Custom width
never shrinks the mobile container. Vertical mobile gap does not affect swipe.

Before deploying to saved templates, run:

```sh
node scripts/migrate-columns.cjs templates/<template>.json
```

The migration maps old shared gaps to both axes, removes retired tablet and
custom breakpoint settings, and wraps existing content in Column blocks. Original
content IDs, content settings, order and disabled state are retained. Old middle/
bottom alignment moves into child Group layout instead of remaining a Grid option.
Migration is idempotent. Changes affect local JSON only.

Validate with `node --test tests/columns.test.cjs` and full Theme Check.

## Column contract

Adding a Column creates Image → Heading → Text → Button, matching the reference
composition with original copy. Its preset uses vertical direction, left alignment,
Fit height and 8px desktop/mobile gaps. Adding Columns creates four such columns
with matching Heading titles, original descriptions and Button label buttons. Preset changes apply to
new blocks; existing merchant content is retained.

`blocks/_columns-column.liquid` is the dedicated child of Columns. Row/Footer
continue using `_column`. Columns owns track width; its Column exposes no width
control. Column owns direction, alignment/position, gaps (default 8px), Fit/Fill
height, border, radius (including Custom), five shadow choices, background
image/mobile image/video, overlay color/blur, inherited/scheme color, block link
and all four padding edges with mobile overrides.

Horizontal direction reveals Position, horizontal Alignment (including Space
between), Vertical on mobile, and conditional Alignment (mobile). Vertical
Position is visible only with Fill height. Custom radius, image/mobile image,
video, overlay color/blur, scheme, and mobile padding each use their respective
`visible_if` branch. Image uses the shared responsive media renderer; background
video uses an idempotent module that pauses offscreen and with reduced motion.
Block links remain siblings of interactive child content, with editor navigation
suppressed. No nested anchors are introduced.

## Change history — 2026-10-14

- `0c7639ba`: initial Grid rebuild displaying Columns while retaining `grid`.
- Follow-up: rename runtime type/file to `columns`, CSS hooks to `block-columns`,
  CSS variables/locales/tests/docs to Columns, and migrate saved template types
  and local block IDs. Retire `blocks/grid.liquid`.
- Replace direct `_column` children with `_columns-column`, based on the reference
  Column editor, including hidden settings. Preserve existing content IDs/order,
  disabled state, explicit gaps and padding (legacy child gaps above 50px are clamped to the
  reference range). Shared `_column` remains for Row.
- Migration entry point is now `scripts/migrate-columns.cjs`; it accepts legacy
  `grid` and current `columns` and is idempotent. Run it on any saved remote JSON
  before deploying this rename. This local change does not migrate store data.
- Reference theme 139629002837 was inspected without saving; Save was disabled
  after restoring the tested options.

Validation: seven Columns tests pass, covering migration idempotency, hidden
branches, zero gaps, ignored retired breakpoint settings, surface rendering, editor links
and mobile padding. JavaScript syntax and diff whitespace checks pass. Full
Theme Check reports no errors and six existing warnings in unrelated files.
Storefront/Theme Editor runtime QA of the rebuilt local code is still pending.

- Removed Custom columns and Columns per breakpoint, including parsing, CSS
  overrides, locale entries and saved template values. Desktop/mobile counts
  now exclusively control the layout.
