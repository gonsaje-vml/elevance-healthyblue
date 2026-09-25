# Automated asset index

The `Refresh search asset index` GitHub Actions workflow inventories downloadable
files in selected Document Authoring directories and refreshes two indexes. PDF
text is extracted so the Search block can match body content; other supported
files receive searchable filename metadata.

- `/asset-index-preview.json` contains assets available on `.aem.page`.
- `/asset-index.json` contains assets available on `.aem.live` and remains the
  production-compatible filename.

The Search block combines `/query-index.json` with the matching asset index. It
selects the preview index on `.aem.page` and local development, and the published
index on live and production domains.

The same run also builds autocomplete-ready phrase catalogs from page titles,
page H1 values, and document titles:

- `/search-key-phrases-preview.json` uses the preview page and asset indexes.
- `/search-key-phrases.json` uses the live page and asset indexes.

The phrase files normalize and deduplicate values, exclude configured utility
pages and `noindex` records, and retain source counts and content types. They do
not mine arbitrary phrases from document body text, which would make suggestions
large and noisy. A small curated synonym list can be layered in later if search
analytics identify important terms that are absent from authored titles.

## Configuration

Edit `roots` and the safety limits in `asset-index.config.json`. Roots may overlap;
the crawler visits each directory once and deduplicates assets by path. Keep
`minimumFiles` above zero and `allowPartial` set to `false` so a bad root or failed
download cannot replace a complete index.

The `outputs` and `keyPhrases.outputs` maps give each delivery environment its own
files. A source-only asset is skipped from both. Removing an asset from preview
removes it from the next preview index; unpublishing it removes it from the next
published index. Each PDF is downloaded from its matching delivery environment,
so newer preview-only text cannot appear in the published index.

The workflow runs when its implementation or configuration is pushed to `main`,
every 15 minutes on the quarter hour, or when manually dispatched. Every run
checks out and updates `main`.

## Authentication

Create these repository Actions secrets from an Adobe OAuth Server-to-Server
credential whose technical account can read `gonsaje-vml/elevance-healthyblue`:

- `ADOBE_CLIENT_ID`
- `ADOBE_CLIENT_SECRET`
- `ADOBE_SCOPES`

The workflow exchanges them for a short-lived IMS access token at the start of
each run and masks the token before passing it to the indexer. The workflow also
needs permission to write repository contents, and branch protection must allow
its generated commit.

## Local use

Run the same generator without committing its output:

```text
DA_IMS_TOKEN="<temporary token>" npm run search:index:da
```

Useful overrides:

```text
DA_IMS_TOKEN="<temporary token>" npm run search:index:da:preview -- --roots /docs,/media
DA_IMS_TOKEN="<temporary token>" npm run search:index:da:live -- --pdf-max-pages 20
DA_IMS_TOKEN="<temporary token>" npm run search:index:da:live -- --skip-pdf-text
```

The generator retries transient DA and delivery-status failures, writes atomically,
enforces minimum and maximum record counts, and refuses partial output by default.
Unchanged records are reused by path and delivery modification time, avoiding
repeated PDF downloads. Delivery status is checked before reuse so unpreviewed or
unpublished assets are removed from their respective indexes. If a complete index
is unchanged, the generator also skips rewriting that output. Phrase catalogs are
also written atomically and left untouched when their content is unchanged.
