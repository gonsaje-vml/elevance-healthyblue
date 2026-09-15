# GRS Provider Page Import Plan

## Goal
Import `https://provider.bluemedadvgrhs.com/grs-provider/` into the Elevance EDS (Document Authoring) project as a single page, reusing **only existing blocks** (no new blocks), then style the page and its blocks to match the source. Navigation/header is out of scope for now.

## Source Page Structure (Content, top → bottom)
1. **Welcome hero** — "Welcome, providers!" heading, intro paragraph, CTA button (network enrollment).
2. **Quick action cards** — 4 linked cards: Launch Availity, Prior Authorizations, Forms, Training Academy.
3. **Availity access** — subheading, 3-item bulleted list, login button, note + registration link.
4. **Provider news** — paragraph + link to Provider News.
5. **Provider tools & resources** — 6-item bulleted list, "network enrollment?" subheading, CTA button, Provider Services phone.
6. **Footer** — 3 links (Privacy, Fraud, Terms), copyright, Blue Cross/Shield affiliation (deferred with nav).

## Block Mapping (existing blocks only)
Project blocks: `accordion, cards, columns, embed, footer, form, fragment, header, hero, modal, quote, search, table, tabs, video`. No catalog present → block generation is per-page and constrained to reuse only these.

| Source section | Existing block / approach |
|---|---|
| Welcome hero | `hero` block |
| Quick action cards (4 links) | `cards` block |
| Availity access | Default content (heading, list, buttons) — `columns` only if layout warrants |
| Provider news | Default content (paragraph + link/button) |
| Provider tools & resources | Default content (heading, list, buttons) |
| Footer | Deferred (handled with nav) |

> No new blocks will be created. Any section that doesn't fit an existing block becomes default content.

## Checklist
- [ ] **Project setup** — confirm project type (DA) and library URL via `.migration/project.json`.
- [ ] **Identify page template** — run classify pipeline on the single URL → `tools/importer/page-templates.json`.
- [ ] **Page analysis** — identify sections, content sequences, and default-content vs. block decisions.
- [ ] **Block reuse check** — confirm every mapped block is an existing one; create nothing new.
- [ ] **Block mapping** — populate DOM selectors onto the template for the existing blocks.
- [ ] **Import infrastructure** — generate parsers/transformers for the mapped blocks.
- [ ] **Generate import script & run import** — produce `content/*.plain.html` via the bundled import script (never hand-written HTML).
- [ ] **Preview** — verify blocks render and content is complete vs. source; fix broken image/link refs.
- [ ] **Style page & blocks** — extract source styles and apply to hero, cards, and default content.
- [ ] **Visual critique & iterate** — compare against source and refine until it matches.
- [ ] **Final verification** — confirm content completeness and styling; report result (nav deferred).

## Notes & Constraints
- **No new blocks** — reuse only existing project blocks.
- **Navigation/header excluded** this pass.
- Content HTML produced only via the import script.

---
**⚠️ Execution requires Execute mode.** I've already begun (created the migration task list), but file-writing steps are blocked while plan mode is active. Please exit plan mode / switch to Execute mode (accept this plan) and I'll immediately proceed with project setup, scraping, and the rest of the checklist.
