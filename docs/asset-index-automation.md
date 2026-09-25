# Automated asset index

The `Refresh search asset index` GitHub Actions workflow inventories
downloadable files in selected Document Authoring directories and refreshes the
repository-root `asset-index.json`. PDF text is extracted so the Search block can
match body content; other supported files receive searchable filename metadata.

The Search block combines `/query-index.json` for authored pages with
`/asset-index.json` for downloads.

## Configuration

Edit `roots` and the safety limits in `asset-index.config.json`. Roots may overlap;
the crawler visits each directory once and deduplicates assets by path. Keep
`minimumFiles` above zero and `allowPartial` set to `false` so a bad root or failed
download cannot replace a complete index.

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
npm run search:index:da -- --roots /docs,/media
npm run search:index:da -- --pdf-max-pages 20
npm run search:index:da -- --skip-pdf-text
```

The generator retries transient DA failures, writes atomically, enforces minimum
and maximum record counts, and refuses partial output by default. Unchanged records
are reused by path and DA modification time, avoiding repeated PDF downloads. If
the complete index is unchanged, the generator also skips rewriting the output.
