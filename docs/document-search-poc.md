# Four-Record Search Proof of Concept

Date: September 16, 2026
Branch: `sandbox`

## What this proves

This proof of concept searches two explicitly indexed provider pages and two PDF
records. It proves the Search block can search and rank a small combined index
without waiting for the hosted EDS page index or a production PDF full-text service.

It does not claim that EDS automatically indexes PDF files. The current
`/query-index.json` is missing, and EDS page indexing does not create records for
uploaded PDF assets.

## Run the combined search locally

The repository includes a local crawler and a development-only search page. The
crawler creates `query-index.local.json` from pages reachable through the local
AEM proxy. The demo searches that generated page index together with
`documents-index.json`.

Use two terminals from the repository root:

```text
# Terminal 1: serve the EDS site and DA content
aem up --no-open

# Terminal 2: crawl the locally served provider pages
npm run search:index:local
```

Then open:

```text
http://localhost:3000/tools/search-demo.html
```

Try `provider`, `enrollment`, or text from one of the crawled pages. The generated
`query-index.local.json` is ignored by Git and is not intended for deployment.
The demo page is excluded by `.hlxignore`; it is only a repeatable local harness.

Optional crawler flags allow another preview origin, starting page, site scope,
output file, or crawl limit:

```text
node tools/build-local-search-index.mjs \
  --base http://localhost:3000 \
  --seed / \
  --scope /north-carolina-provider/ \
  --max-pages 100 \
  --output query-index.local.json
```

The committed `helix-query.yaml` is the production counterpart. Use
`aem up --print-index` to verify its selectors locally, then configure/reindex it
through the EDS Index Admin before relying on `/query-index.json` in preview or
live delivery.

## Repository changes

- `fstab.yaml` now mounts the DA content at
  `https://content.da.live/gonsaje-vml/elevance-healthyblue/`.
- `/documents-index.json` contains two page records and two PDF records.
- The Search block now caches and merges page/PDF sources, waits until three characters are entered,
  searches all terms, ranks title matches first, reports result counts, labels PDF
  results, and handles index errors.

## Check the index

After the branch is deployed, open:

```text
https://sandbox--elevance-healthyblue--gonsaje-vml.aem.page/documents-index.json
```

The response should have a `data` array with exactly four records. The EDS native
page index is a separate endpoint:

```text
https://sandbox--elevance-healthyblue--gonsaje-vml.aem.page/query-index.json
```

That endpoint will remain 404 until an EDS query index is configured and reindexed.

## Author the search page in DA

For the temporary sandbox demonstration, the header search opens:

```text
https://sandbox--elevance-healthyblue--gonsaje-vml.aem.page/tools/search-demo.html
```

For the permanent implementation, create `/north-carolina-provider/search` in DA with:

1. An H1 such as **Search provider documents**.
2. A Search block.
3. The Search block URL set to `/documents-index.json`.
4. The Search block link text set to `Document index`.
5. The `minimal` block variant if a vertical result list is preferred.

Preview the page and test:

- `communications` — Provider Communications page
- `medical management` — Medical Management Model page
- `known` — Known Issues Bulletin
- `NCTracks` — Provider Enrollment Data Guidance
- `enrollment guidance` — Provider Enrollment Data Guidance

The query is retained in the page URL as `?q=`.

## Verify the PDF destinations

The working sandbox PDF URLs are:

```text
https://sandbox--elevance-healthyblue--gonsaje-vml.aem.page/docs/nc-caid-knownissueslist.pdf
https://sandbox--elevance-healthyblue--gonsaje-vml.aem.page/docs/nc-caid-providerenrollmentdataguidance.pdf
```

The earlier 404s were caused by an index typo: the real filenames begin with
`nc-caid`, not `nc-aid`. Both corrected URLs returned HTTP 200 on September 17,
2026.

## Next extension

Once `/query-index.json` exists, the Search block can load both the page and
document indexes, normalize them to the same record shape, and merge them before
filtering. Full-text searching inside PDFs remains a separate extraction/search
service decision.
