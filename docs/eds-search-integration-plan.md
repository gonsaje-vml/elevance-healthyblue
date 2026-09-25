# Healthy Blue NC EDS Search Integration Plan

Date: September 16, 2026
Status: Recommended implementation; not yet implemented
Scope: `/north-carolina-provider/**`

## Recommendation

Implement search in two layers:

1. Use the native AEM Edge Delivery Services query index for authored HTML pages.
2. Add a separate document index for migrated PDFs and merge both result sets in the Search block.

This provides a small, EDS-native first release without coupling the new site to the
legacy Oracle search service. It also creates a clean upgrade path if the launch
requires full-text PDF search: replace the browser-side document index with an
approved server-side search provider while keeping the same user interface and
result schema.

The decision that changes the size of the solution is:

> Must search find words inside PDF files, or is searching a PDF's authored title,
> description, and topic sufficient for launch?

- **Metadata search is sufficient:** use the two JSON indexes described here.
- **PDF body text is required:** use an extraction/crawling pipeline and a
  server-side search service. Do not send the full text of hundreds or thousands
  of PDFs to every visitor's browser.

## Current state

The Adobe preview currently has no working search experience:

- `/north-carolina-provider/search?q=provider` returns 404.
- `/query-index.json` returns 404.
- The repository has a stock Search block, but it has no published index to read.
- There is no `helix-query.yaml` in the repository.
- The migration audit found 256 unique `/docs/` targets returning 404, so document
  publication must happen before document search can be considered complete.

The Search block in this branch is a useful starting point, not a finished
implementation. It currently:

- defaults to `/query-index.json`;
- downloads the index again on every input event;
- searches only the title/header, description, and path slug;
- has no topic filters, autocomplete, count, pagination, loading state, or error state;
- displays all matches at once;
- can throw after an index request fails because the failure returns `null`;
- creates an anchor inside another anchor for result titles, which is invalid HTML;
- uses a generic card grid rather than the source site's search-result layout.

## Legacy search behavior to preserve

The current Oracle site provides the following behavior:

- Header search navigates to
  `/north-carolina-provider/search?q=<term>`.
- Autocomplete begins after three characters.
- Results include provider pages and PDFs.
- The results page displays a total count.
- Ten results are initially displayed; **Load More** adds ten results.
- Four user-facing topic filters are available:
  - Policies/Guidelines/Manuals
  - Claims/Billing
  - Prior Authorization/Eligibility
  - Forms

Observed legacy endpoints:

```text
/sites/Satellite?pagename=gbdPro/eSearchAutoCompleteProxy
  &q=<encoded query>
  &tenant=gbd_providerpublic

/sites/Satellite?pagename=gbdPro/eSearchServiceProxy
  &q=<encoded query>
  &facets-ssite=[HBNC]
  &tenant=gbd_providerpublic
  &facets=[topic, application]
  &pgOffset=1
  &pgSize=10
```

Selected topic filters are sent through the legacy `facets-topic` parameter.
These endpoints are useful for documenting expected behavior, but they should not
be the permanent EDS integration. They are tied to the Oracle origin, service
availability, tenant configuration, and cross-origin policy that the migration is
intended to leave behind.

## Proposed architecture

```text
Published DA pages                     Published/migrated documents
        |                                          |
        v                                          v
EDS query index                          documents-index.json
/query-index.json                       (metadata records for PDFs)
        |                                          |
        +------------------+-----------------------+
                           v
                    Search data layer
              normalize -> filter -> rank
                           |
                           v
        Search page, autocomplete, filters, results
```

Both sources should be normalized to the same record shape:

```json
{
  "path": "/north-carolina-provider/forms/example.pdf",
  "title": "Example Provider Form",
  "description": "Short summary shown in search results.",
  "header": "Optional primary page heading",
  "content": "Optional searchable page text",
  "topic": "forms",
  "type": "pdf",
  "lastModified": "2026-09-16T12:00:00.000Z"
}
```

Allowed `type` values should initially be `page` and `pdf`. Use stable topic values
instead of display labels:

| Authored value | Display label |
| --- | --- |
| `policies-guidelines-manuals` | Policies/Guidelines/Manuals |
| `claims-billing` | Claims/Billing |
| `prior-authorization-eligibility` | Prior Authorization/Eligibility |
| `forms` | Forms |

## Page query index

AEM's documented query-index mechanism publishes indexed page data as JSON, with
`/query-index.json` as the conventional target. The index contains published
content, even when it is requested from an `.aem.page` preview domain.

The Adobe team should first confirm whether the project uses the AEM Configuration
Service. A Configuration Service query configuration overrides a repository
`helix-query.yaml`. If no service configuration is present, add this draft to the
repository root and adjust the selectors against representative imported pages:

```yaml
indices:
  provider-pages:
    include:
      - /north-carolina-provider/**
    exclude:
      - /north-carolina-provider/search
      - /north-carolina-provider/fragments/**
    target: /query-index.json
    properties:
      path:
        select: none
        value: path
      title:
        selectFirst: head > meta[property="og:title"]
        value: attribute(el, "content")
      description:
        selectFirst: head > meta[name="description"]
        value: attribute(el, "content")
      header:
        selectFirst: main h1
        value: textContent(el)
      content:
        selectFirst: main
        value: textContent(el)
      topic:
        selectFirst: head > meta[name="search-topic"]
        value: attribute(el, "content")
      type:
        selectFirst: head > meta[name="search-type"]
        value: attribute(el, "content")
      robots:
        selectFirst: head > meta[name="robots"]
        value: attribute(el, "content")
      lastModified:
        select: none
        value: parseTimestamp(headers["last-modified"], "ddd, DD MMM YYYY hh:mm:ss GMT")
```

Implementation notes:

- Validate this configuration in the Index Admin tool before committing it.
- Inspect several records using the Admin API's page-index representation or
  `aem up --print-index`.
- Reindex after creating or changing the configuration.
- Exclude pages authored with `robots: noindex` in the Search block, even if the
  record is present.
- Normalize a missing `type` to `page` in code so existing content does not need
  an immediate bulk metadata update.
- The EDS indexer reads the source HTML selected by the configuration; it does not
  see content inserted later by client-side JavaScript.

### DA metadata for pages

Add these rows to the existing page Metadata block when classification is needed:

| Metadata | Value |
| --- | --- |
| Search Topic | `forms` |
| Search Type | `page` |

`Search Type` can be omitted for normal pages if the code defaults it to `page`.
`Search Topic` should be left blank for pages that do not belong to one of the four
legacy filters.

If authors need friendly controls rather than free-text values, add `search-topic`
as a select field in the project's metadata model. Do not create a visible Search
Topic block in page content.

## PDF/document index

The documented EDS query index selects values from published page HTML. Based on
that mechanism, native PDF body extraction is not part of the page query index.
That is an inference from Adobe's indexing model, not an Adobe statement that EDS
can never participate in a broader document-search solution.

### Recommended first release: metadata-only PDF search

Generate `/documents-index.json` from the authoritative migrated-document inventory.
Each record should contain:

- published document URL;
- human-readable title;
- short description, when available;
- one of the stable topic values;
- `type: pdf`;
- last-modified timestamp;
- optional source URL and migration ID for internal traceability, but do not expose
  sensitive source metadata to the browser.

The index generator must reject or report records whose target document does not
return 200. This prevents the current broken `/docs/` links from becoming search
results.

The Search block should fetch `/query-index.json` and `/documents-index.json` once,
normalize the records, and search both collections together. This gives users page
and PDF results without requiring a search service.

### Full-text PDF search

If words inside PDF files must be searchable, introduce a server-side index:

1. Crawl or receive the published page and document inventory.
2. Extract text and metadata from PDFs.
3. Store normalized page and document records in an approved search service.
4. Expose query, filter, paging, and autocomplete through a same-origin endpoint or
   an approved cross-origin API.
5. Keep the browser response small and return only the requested result window.

EDS sitemap output can help seed a crawler after the sitemap is correctly
configured. The current migration audit found the preview sitemap contained no
URLs, so sitemap configuration is a separate prerequisite.

## Search block changes

The upgraded block should separate data loading, normalization, searching, and
rendering so the PDF source can later be replaced without rewriting the UI.

### Data loading

- Fetch each configured source once and cache the promise for the page lifetime.
- Treat failed or malformed sources as an error state rather than passing `null`
  to the filter function.
- Continue searching the surviving source when one of two sources fails, but tell
  the user that results may be incomplete.
- Normalize whitespace, topic values, content type, and URL before ranking.
- Remove duplicate records by canonical path.

### Query behavior

- Keep the query in `?q=` so results are linkable and browser navigation works.
- Begin autocomplete and results after three non-space characters.
- Debounce input by approximately 200 milliseconds.
- Use all query terms for general results. A result should not match merely because
  it contains one common term from a multi-word query.
- Normalize case and diacritics before matching.
- Suggested ranking order:
  1. exact title;
  2. title begins with the query;
  3. all terms in title or H1;
  4. all terms across title and description;
  5. all terms across indexed page content;
  6. path/slug match.
- Use a deterministic secondary sort, such as title, when scores are equal.

### Results and filters

- Display total result count.
- Show ten results initially.
- **Load More** reveals ten additional records while preserving the query and
  filters in the URL.
- Allow the four legacy topic filters and display their current counts.
- Clearly label PDFs and, when available, file size or modified date.
- Each result should contain one valid link, not nested anchors.
- Provide loading, partial-data warning, no-results, and fatal-error states.
- Highlight matched text without changing the accessible name of the result.

### Autocomplete

- Build suggestions from page/document titles and H1 values for the metadata-only
  implementation.
- Limit suggestions to approximately eight unique values.
- Prefer title prefix matches, followed by title token matches.
- If implemented as a custom popup, follow the ARIA combobox/listbox keyboard
  pattern: arrow keys move, Enter selects, Escape closes, and focus remains
  predictable. A plain search field without autocomplete is preferable to an
  inaccessible custom autocomplete.

### Accessibility

- Use a visible `<label>` for the search field; a placeholder alone is insufficient.
- Announce result counts and asynchronous updates with a restrained `aria-live`
  region.
- Group topic filters in a `<fieldset>` with a `<legend>`.
- Preserve visible keyboard focus.
- Ensure **Load More** returns focus to an appropriate location and does not cause
  an unexpected page jump.
- Use heading levels consistent with the search page's H1.

## DA authoring

Create and publish `/north-carolina-provider/search` with:

1. An H1 such as **Search Healthy Blue North Carolina Providers**.
2. A Search block.
3. Optional authored help text below the block.
4. Metadata for title, description, and `robots` according to the team's SEO
   decision for internal search-result pages.

The current component model requires one URL in the Search block. To support the
recommended two-source model cleanly, update it to provide:

| Field | Suggested value |
| --- | --- |
| Page index URL | `/query-index.json` |
| Document index URL | `/documents-index.json` |

Alternatively, keep `/query-index.json` as the code default and author only the
document index URL. Avoid asking authors to enter either URL on every page; only
the dedicated search page needs this block.

The header's Search link should point to
`/north-carolina-provider/search`. When a user submits text from a header search
field, navigate to `/north-carolina-provider/search?q=<encoded query>`.

## Delivery sequence

### Phase 0: confirm requirements

- Confirm page-only, PDF metadata, or PDF full-text launch scope.
- Confirm the authoritative repo and DA site.
- Confirm whether Configuration Service manages the query index.
- Confirm whether the four legacy filters are required at launch.

### Phase 1: enable page search

- Create and validate the page query-index configuration.
- Reindex and verify `/query-index.json`.
- Create and publish the DA search page.
- Correct the current Search block's error handling, HTML, caching, ranking, URL
  state, result count, and ten-result paging.
- Connect the shared header to the search route.

### Phase 2: add document search

- Complete or establish valid destinations for migrated PDFs.
- Generate and publish `documents-index.json`.
- Merge normalized document records into results.
- Add PDF labels and document-specific analytics.

### Phase 3: parity and hardening

- Add topic filters and accessible autocomplete.
- Validate mobile behavior, keyboard navigation, screen-reader announcements, and
  no-JavaScript fallback expectations.
- Add analytics for submitted terms, no-result terms, filter use, result clicks,
  and Load More.
- Decide whether metadata search meets real usage; move to server-side full-text
  search only if required.

## Acceptance criteria

- `/north-carolina-provider/search?q=provider` returns a published search page.
- `/query-index.json` returns valid JSON and contains representative published
  provider pages.
- Search does not issue another index request for every keystroke.
- A three-character query displays ranked results, a count, and at most ten initial
  records.
- Query and selected filters survive reload, Back, Forward, and copied URLs.
- Topic filters produce the expected subset and count.
- Load More reveals ten additional results without losing focus or filters.
- Pages marked `noindex` are excluded.
- PDF records never point to a 404.
- A failed index displays a usable error/partial-results state.
- Keyboard-only users can operate search, filters, suggestions, results, and Load
  More.
- Automated accessibility tests report no serious violations in the block, followed
  by manual keyboard and screen-reader verification.

## Test queries

Use terms that cover the major content types and legacy integrations:

- `provider`
- `Amoxicillin`
- `prior authorization`
- `claims submission`
- `training`
- `reimbursement policy`
- an exact PDF title
- a term present only inside a PDF, if full-text PDF search is selected
- a misspelling and a query with no results

## Official Adobe references

- [AEM Edge Delivery Services — Indexing](https://www.aem.live/developer/indexing)
- [AEM Edge Delivery Services — Indexing Reference](https://www.aem.live/docs/indexing-reference)
- [AEM Edge Delivery Services — Configuration Service Setup](https://www.aem.live/docs/config-service-setup)
- [AEM Edge Delivery Services — Sitemap](https://www.aem.live/developer/sitemap)
- [Adobe AEM Block Collection — Search block](https://github.com/adobe/aem-block-collection/blob/main/blocks/search/search.js)
- [AEM Edge Delivery Services FAQ](https://www.aem.live/docs/faq)
