# Healthy Blue NC Migration Context

This document preserves the actionable context recovered from the pinned chat
**“Scan Site Structure”** on 2026-09-15. It is a working brief, not a substitute
for confirmed client requirements.

## Correct target

- Source site: [Healthy Blue North Carolina Providers](https://provider.healthybluenc.com/north-carolina-provider)
- Source CMS: Oracle CMS
- Target platform: Adobe Edge Delivery Services (EDS), using Document Authoring (DA)
- Adobe-generated starting point: [AdobeDrago/elevance](https://github.com/AdobeDrago/elevance/tree/main)
- Adobe project notes: [adobedrago.github.io/elevance](https://adobedrago.github.io/elevance/)
- At the time of the assignment, Adobe Sandbox access had not yet been provided,
  so work was expected to proceed in a local environment.

## Jaehyun's assignment

1. Act as the central point for local integration testing.
2. Get the Experience Modernization Agent-generated code running locally.
3. Identify the main visual, SEO, and accessibility issues.
4. Start investigating the existing search experience, then support Josue
   Morataya when he takes ownership.

“Central point” means maintaining the shared view of what works together in the
local build, what is blocked, and what depends on another workstream. It does not
mean owning every repair or integration implementation.

## Immediate checkpoint deliverables

- A working local preview, including repeatable startup instructions.
- A short record of which representative pages work and any run blockers.
- An initial issue list with concrete examples:
  - Visual: layout, imagery, navigation, and responsive behavior.
  - SEO: titles, descriptions, headings, links, and URLs.
  - Accessibility: keyboard use, labels, alternative text, and contrast.
- Initial search findings: service or endpoint used, request parameters, content
  types indexed, result behavior, and open questions for Josue.
- Integration status: what works locally, what needs Adobe access, and what is
  waiting on other owners.

The checkpoint expectation was demonstrable progress—not a completed migration.
Use this priority order:

1. Fix blockers that prevent the local site from running.
2. Fix small, obvious issues when time permits.
3. Document larger visual, SEO, and accessibility work for prioritization.
4. Investigate search and prepare the handoff.

## Related workstreams and ownership

| Workstream | Initial owner(s) | Relationship to this project |
| --- | --- | --- |
| Content migration through EDS Document Authoring | Luis Felix; Federico Arriola to lead on return | Integrate and test migrated content locally. |
| Prior authorization lookup | Luis Felix initially; Federico Arriola and Jose Angel Badilla later | Determine required parameters and mock the real service behavior. |
| Forms/document lookup | Luis Felix initially; Federico Arriola and Jose Angel Badilla later | Determine required parameters and mock the PDF retrieval behavior. |
| Search | Jaehyun initially; Josue Morataya to own on return | Discover current behavior and recommend an EDS implementation. |

Integration references:

- [Prior Authorization Lookup Tool](https://provider.healthybluenc.com/north-carolina-provider/prior-authorization-lookup)
- [Forms](https://provider.healthybluenc.com/north-carolina-provider/forms)

## Important scope correction

The earlier chat also contains a scan of `bcbsnc.com` that reported 190 candidate
routes, 40 inspected pages, and a provisional block/page-family inventory. That
scan is **not an inventory of Healthy Blue NC Providers** and must not be used to
estimate this migration.

The general design heuristic remains useful—prefer existing blocks, variants,
default content, and section styles before creating new blocks—but every block,
page type, route count, and integration must be revalidated against the correct
Healthy Blue source site.

The earlier instruction that login-gated pages are out of scope came from the
`bcbsnc.com` scan. Treat that as an assumption to confirm for Healthy Blue, not as
a confirmed requirement for this migration.

## Current repository reality check (2026-09-15)

- The checked-out remote is `gonsaje-vml/elevance-healthyblue`, not the original
  AdobeDrago repository named in the assignment.
- [`docs/index.html`](./index.html) describes both `elevance` and `elevance-nc`
  DA sites and identifies Healthy Blue NC as the primary sprint target.
- [`.migration/project.json`](../.migration/project.json) currently configures
  only the `elevance` DA site; the documented `elevance-nc` mapping is not present.
- The only checked-in migration plan targets the separate GRS provider page:
  [`.migration/plans/grs-provider-page-import.md`](../.migration/plans/grs-provider-page-import.md).
- The existing search block reads a JSON index (default `/query-index.json`) and
  filters it in the browser. This is a reusable baseline, not proof that it
  matches the source site's search behavior or complete indexing requirements.

## Open decisions

- Confirm the full Healthy Blue NC route inventory and explicit exclusions.
- Reconcile the `elevance-nc` documentation with `.migration/project.json`.
- Confirm which repository and DA site are authoritative for delivery.
- Obtain or confirm Adobe Sandbox access.
- Obtain the pending Figma and Word samples, if they are still part of scope.
- Define acceptance criteria for search, prior authorization, and forms mocks.

