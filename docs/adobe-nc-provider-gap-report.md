# Healthy Blue NC Adobe Migration Gap Report

Audit date: September 16, 2026
Source: [Healthy Blue North Carolina Providers](https://provider.healthybluenc.com/north-carolina-provider/home)
Adobe preview: [Elevance NC on AEM Edge Delivery Services](https://main--elevance-nc--adobedrago.aem.page/north-carolina-provider/home)

## Executive summary

Adobe has made substantial progress on **bulk page migration**. All 48 identified Healthy Blue NC provider routes return HTTP 200 in the Adobe preview, all 48 page titles match the source, every page has a meta description, and most visible text has been carried over.

The preview is not yet production-ready. The most important gaps are:

1. **Document migration is incomplete.** Of 294 unique internal page/document targets checked, 257 return 404. Of those failures, 256 are `/docs/` resources. Twenty-five of the 48 pages contain at least one broken internal target.
2. **Search is not implemented.** Both `/north-carolina-provider/search?q=provider` and `/query-index.json` return 404.
3. **Prior authorization is only a UI shell.** The migrated page omits the H1 and source guidance, and its block has no configured lookup data source.
4. **Forms are not functionally equivalent.** Source accordion groups are flattened into visible link buttons, and 20 migrated form/document targets return 404.
5. **The shared header is visibly and semantically broken at a common desktop width.** Branding has insufficient contrast on white, navigation labels overlap, primary navigation items are exposed as plain text rather than links/buttons, and search/font-size controls are absent.
6. **Accessibility foundations need remediation.** All 48 preview pages omit the document language, no equivalent source skip links were found, four pages have no H1, nine pages contain heading-level jumps, and 56 rendered images use empty alternative text across seven pages.
7. **Five routes need immediate content/functional review:** `archives`, `forms`, `medical-policies-and-clinical-guidelines`, `prior-authorization-lookup`, and `reimbursement-policies`.

## Scope and method

- Audited the 47 interior URLs in Adobe's importer inventory plus the homepage: **48 routes total**.
- Requested every source and preview route and compared status, title, description, canonical URL, H1s, headings, main-content text, link text, images, and basic document structure.
- Checked **294 unique internal preview page/document targets** for availability.
- Manually reviewed rendered source/preview pairs for representative templates and high-risk experiences: homepage, Claims, Forms, Archives, Resource Library, Training Academy, and Prior Authorization Lookup.
- Inspected Adobe's public repository implementation for the search and prior-authorization blocks and the 47-page importer.

Text-similarity scores are triage signals, not final editorial approval. The Oracle source includes hidden modal and dynamically loaded content, so pages identified by the automated comparison were manually reviewed before being classified as critical.

## What is working

- **48/48 migrated page routes return 200.**
- **48/48 page titles match the current source.**
- **48/48 pages contain a meta description.**
- **48/48 pages have a self-referencing canonical URL.**
- Average main-content text similarity is approximately **94.9%**.
- Average link-label coverage is approximately **99.3%**.
- The Claims landing-page hero, imagery, title banner, and quick-action links are visually close to the source.
- Interior content for most article-style pages is substantially present.
- Footer content and most cross-page provider-resource links are present.
- Adobe created a reusable importer and multiple page-shape blocks, including hero, icon-link, featured-card, document-list, resource-grid, archive-table, and prior-authorization blocks.

## Critical functional gaps

### Search

- `/north-carolina-provider/search?q=provider` returns 404.
- `/query-index.json` returns 404, so the included EDS Search block has no index to query.
- The source autocomplete, result facets, result counts, and Load More behavior are not represented.
- PDF/document indexing is not addressed. This is especially important because the source result set includes provider pages and PDFs.

**Required:** author the search page, publish a query index, define PDF/document indexing, wire the header search, and decide whether source autocomplete/facets are required for launch.

### Forms and documents

- The source Forms page uses expandable categories; the preview expands/flattens the categories into long stacks of link buttons.
- The preview does not reproduce the source interaction or the detected form-index service behavior.
- **256 unique internal `/docs/` targets return 404.**
- The Forms page alone contains **20** broken migrated document targets.

**Required:** migrate/publish documents or temporarily retain valid source URLs; restore the category/accordion experience; determine whether the source form-index service must be mocked or whether authored lists are accepted.

### Prior Authorization Lookup

- The source page includes an H1, eligibility warnings, usage constraints, instructions, and follow-up guidance. The preview begins directly with fields and omits this context.
- The preview page has no H1.
- The block is a client-side mock that requires an authored JSON data source; the current page has no usable data source configured.
- The source flow's lookup service behavior and drug/code results are not reproduced.

**Required:** restore the missing content and semantic structure, configure an approved mock dataset/service, verify market and line-of-business parameters, and test known terms such as Amoxicillin.

### Shared header and navigation

- At a 1265-pixel desktop viewport, the preview header loses the two blue brand/navigation bands, renders pale branding on white, and overlaps navigation labels.
- Primary navigation labels appear as plain text in the accessibility tree rather than operable links or buttons.
- Source search and font-size controls are absent.
- Source skip links for header, navigation, main content, and footer are absent.

**Required:** repair the desktop breakpoint/layout, restore contrast and two-tier styling, use semantic interactive controls, restore keyboard/focus behavior, and add skip links.

## High-risk content gaps

### Archives

- The current source is a short page directing users to Provider News.
- The preview instead contains a stale 2023 archive listing and Load More experience.
- The preview has no H1 and contains 20 broken document targets.

### Medical Policies and Clinical UM Guidelines

- Source accordion/modal content appears to have been materialized into normal page content in the preview.
- The medical-policy acknowledgement content is duplicated/flattened rather than presented in the source interaction.
- The preview heading hierarchy contains a level jump.

### Reimbursement Policies

- The preview expands a large policy inventory into the page body.
- Sixty-three policy document links return 404.
- The page has low structural parity and a heading-level jump.

### Forms

- The source accordion interaction is missing.
- Extra dynamic form categories are flattened into buttons.
- Twenty document links return 404.

### Prior Authorization Lookup

- Missing H1, warnings, instructions, and functional data source.
- The page currently cannot provide equivalent lookup results.

## Visual gaps

### Global

- Header branding, background colors, spacing, and navigation layout do not match the source at the audited desktop width.
- Long navigation labels collide rather than distributing across the second header row.
- Typography and content widths vary from the source across interior templates.
- Responsive/mobile behavior still requires a separate viewport regression pass.

### Template-specific

- **Claims/landing template:** hero and quick links are close; the shared header remains the dominant visual defect.
- **Forms/document template:** source blue title banner and accordion presentation are missing; preview content becomes a long flat list.
- **Prior-authorization tool:** source blue title banner and explanatory content are missing; preview starts with the form controls.
- **Archives:** preview presents an obsolete archive experience instead of the current source page.
- **Homepage:** welcome hero/content are broadly present, but the shared header is broken and all ten rendered images currently have empty `alt` values.

## SEO gaps

### Passing

- 48/48 source and preview routes return 200.
- 48/48 titles match the source.
- 48/48 descriptions are populated.
- 48/48 preview pages have canonical URLs.

### Failing or incomplete

- `lang` is missing from the HTML document on all 48 preview pages.
- `/query-index.json` is missing.
- The search results route is missing.
- `/sitemap.xml` returns 200 but currently contains **zero URLs**.
- The `.aem.page` robots file disallows crawling. That is expected for preview, but production-host robots and sitemap configuration still need to be completed.
- Four pages have no H1; two are migration regressions and two are inherited source issues.
- Broken document targets prevent search engines and users from reaching a large portion of the resource library.

## Accessibility gaps

- No source-equivalent skip links were found in the preview.
- The primary navigation is not exposed as a usable set of links/buttons in the accessibility tree.
- All 48 preview pages omit `lang="en"`.
- Four pages have no H1:
  - `archives` — migration regression; source has an H1.
  - `prior-authorization-lookup` — migration regression; source has an H1.
  - `condition-care` — inherited source gap.
  - `hedis` — inherited source gap.
- Nine pages have a heading-level jump:
  - `care-management`
  - `early-periodic-screening-diagnostic-treatment`
  - `enhanced-personal-health-care-program`
  - `learn-about-availity`
  - `medical-policies-and-clinical-guidelines`
  - `reimbursement-policies`
  - `reimbursement-policy-definitions`
  - `reimbursement-policy-disclaimer`
  - `resources`
- Fifty-six images have empty alternative text across seven pages. Empty text may be correct for decorative assets, but every instance requires an explicit review:
  - `claims`: 6
  - `communications`: 6
  - `join-our-network`: 7
  - `member-eligibility-and-pharmacy`: 9
  - `patient-care`: 10
  - `resources`: 8
  - `home`: 10
- Forms loses the source accordion controls and associated expanded/collapsed semantics.
- Prior Authorization Lookup omits the source instructions and H1 even though its individual fields have labels.

A formal axe/Lighthouse, keyboard-only, focus-order, focus-visibility, zoom/reflow, and color-contrast audit remains required after the global header is corrected.

## Broken-document concentration

| Page | Broken internal targets |
|---|---:|
| reimbursement-policies | 63 |
| schedules-registration | 48 |
| training-resources | 33 |
| resource-library | 32 |
| archives | 20 |
| forms | 20 |
| manuals-and-guides | 19 |
| maternal-child-services | 10 |
| pharmacy | 9 |
| behavioral-health | 6 |
| serving-diverse-populations | 5 |
| training-academy | 5 |
| home | 4 |
| benefits-partners | 3 |
| sbirt | 3 |
| claims-submissions-and-disputes | 2 |
| electronic-data-interchange | 2 |
| guide-to-drug-coverage-under-medical-benefit | 2 |
| learn-about-availity | 2 |
| communications | 1 |
| condition-care | 1 |
| early-periodic-screening-diagnostic-treatment | 1 |
| join-our-network | 1 |
| prior-authorization | 1 |
| resources | 1 |

The one broken internal page route is `/north-carolina-provider/training-academy-old`. All other failures in this table are document routes.

## Page-by-page matrix

`Good` means the main text and link labels are substantially present. `Review` indicates a structural/editorial difference. `Critical` indicates a stale, flattened, incomplete, or nonfunctional experience. Broken documents are reported independently, so a page can have good text fidelity and still be blocked by its resource links.

| Route | Content fidelity | Broken links | Main flags |
|---|---|---:|---|
| archives | Critical | 20 | Stale archive content; missing H1 |
| behavioral-health | Review | 6 | Heading structure differs |
| benefits-partners | Review | 3 | Heading structure differs |
| care-management | Review | 0 | Heading coverage and level jump |
| claims | Good | 0 | 6 empty-alt images; header defect |
| claims-submissions-and-disputes | Good | 2 | Document publication |
| cme | Good | 0 | Global header/a11y follow-up |
| communications | Good | 1 | 6 empty-alt images |
| contact-us | Good | 0 | Minor content-structure review |
| early-periodic-screening-diagnostic-treatment | Review | 1 | Heading level jump |
| electronic-data-interchange | Good | 2 | Document publication |
| eligibility-provider-reports | Good | 0 | Global header/a11y follow-up |
| enhanced-personal-health-care-program | Review | 0 | Heading level jump |
| forms | Critical | 20 | Accordion flattened; document links fail |
| guide-to-drug-coverage-under-medical-benefit | Good | 2 | Document publication |
| health-education | Review | 0 | Heading structure differs |
| join-our-network | Good | 1 | 7 empty-alt images |
| learn-about-availity | Review | 2 | Heading level jump |
| manuals-and-guides | Good | 19 | Document publication |
| maternal-child-services | Good | 10 | Document publication |
| medical-management | Review | 0 | Heading structure differs |
| medical-policies-and-clinical-guidelines | Critical | 0 | Hidden/modal content flattened; heading jump |
| member-eligibility-and-pharmacy | Good | 0 | 9 empty-alt images |
| patient-care | Good | 0 | 10 empty-alt images |
| patient-care/critical-incidents | Good | 0 | Global header/a11y follow-up |
| pharmacy | Good | 9 | Document publication |
| physician-administered-drug-program | Good | 0 | Global header/a11y follow-up |
| prior-authorization | Review | 1 | Content/heading review |
| prior-authorization-lookup | Critical | 0 | Missing H1/content; lookup not configured |
| privacy-policies | Good | 0 | Global language/skip-link follow-up |
| quality-management | Review | 0 | Heading structure differs |
| referrals | Review | 0 | Lower content coverage; editorial review |
| reimbursement-policies | Critical | 63 | Expanded/flattened listing; heading jump; documents fail |
| reimbursement-policy-definitions | Review | 0 | Heading level jump |
| reimbursement-policy-disclaimer | Review | 0 | Heading level jump |
| resource-library | Good | 32 | Document publication |
| resources | Good | 1 | 8 empty-alt images; heading jump |
| rights-and-responsibilities | Review | 0 | Heading structure differs |
| schedules-registration | Good | 48 | Document publication |
| serving-diverse-populations | Good | 5 | Document publication |
| terms-of-use | Review | 0 | Heading structure differs |
| total-member-view | Review | 0 | Content/heading review |
| training-academy | Good | 5 | Document publication |
| training-resources | Good | 33 | Document publication |
| condition-care | Good | 1 | No H1; inherited source issue |
| hedis | Review | 0 | No H1; inherited source issue |
| sbirt | Good | 3 | Document publication |
| home | Good | 4 | 10 empty-alt images; header defect |

## Recommended remediation order

### P0 — release blockers

1. Publish or relink all 256 missing document assets.
2. Implement search route and index, including the agreed PDF strategy.
3. Configure the Prior Authorization Lookup mock/service and restore the missing source content.
4. Fix the shared header/navigation semantics, layout, contrast, search control, and skip links.
5. Correct the five critical pages.

### P1 — quality gate

1. Add `lang="en"` globally.
2. Correct H1 and heading hierarchy issues.
3. Review all 56 empty-alt images and author meaningful alternatives where images convey content.
4. Restore Forms accordion behavior or document an accepted alternative.
5. Populate the sitemap and validate production robots/CDN configuration.

### P2 — regression and polish

1. Run desktop, tablet, and mobile visual regression by template.
2. Run axe/Lighthouse and manual keyboard/contrast testing.
3. Validate external links and downloadable files after asset publication.
4. Confirm content owner approval for pages whose source contains dynamic or hidden content.

## Conclusion

Adobe's preview demonstrates that the bulk migration pipeline is working and that nearly all page copy has been transferred. The remaining work is concentrated in shared experience quality and integration completeness rather than route creation: documents, search, prior authorization, Forms behavior, header/navigation, and accessibility must be resolved before the site can be treated as migration-complete.
