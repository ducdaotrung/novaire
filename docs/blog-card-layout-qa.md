# Blog card layout QA — 2026-10-21

- Baseline: complete pull of beae-duc-k4mqivfe.myshopify.com development theme 159500927168; clean main worktree before pull. Remote changes and deletions retained.
- Ownership: Blog list owns grid/carousel gap; Blog card owns editorial overlap and responsive media; existing child blocks own article content and remain reorderable.
- Design: 420 × 360 reference image (7:6, scales with available width), desktop content overlap -120px/-60px, white background, 32px padding, 12px content gap. Mobile image/content gap 28px, content padding 0, content gap 8px, date/description 12px and CTA spacing 20px.
- Existing saved child composition/order retained. New and saved cards select Editorial overlap; stacked/horizontal choices remain available.

| Check | Status | Evidence |
| --- | --- | --- |
| Complete remote baseline | pass | Shopify CLI pull completed before edits |
| Liquid/schema | pass | Theme Check: 0 errors, 6 existing warnings outside changed Blog components |
| Range audit | pass | 1,591 range settings; no ranges exceed 101 possible values |
| Diff | pass | Changed Blog files pass git diff --check |
| Regression checks | pass | 15 existing Blog heading and View all tests passed |
| Development upload | pass | Scoped upload to development theme 159500927168 |
| Desktop/mobile visual QA | blocked | Storefront redirects to password page |
| Theme Editor add/remove/reorder/reload | blocked | Authenticated editor session unavailable |
| Additional MCP validation | blocked | Automatic approval review rejected possible source disclosure; local checks completed instead |

No Git commit or push was performed. Local Git diff also includes authoritative remote baseline changes unrelated to this Blog work.
