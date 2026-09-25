# Automated sandbox-search asset index

The `Refresh sandbox search asset index` GitHub Actions workflow inventories
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

The sandbox workflow runs when its implementation or configuration is pushed to
`sandbox-search`. GitHub only schedules workflows from a repository's default
branch, so the daily 05:23 UTC schedule starts after this workflow file also lands
on the default branch. Scheduled and manual runs explicitly update
`sandbox-search`.

## Authentication

Create the repository Actions secret `DA_IMS_TOKEN` with read access to
`gonsaje-vml/elevance-healthyblue`. The workflow also needs permission to write
repository contents and branch protection must allow its generated commit.

IMS bearer tokens expire. Refresh the secret after HTTP 401 or 403 failures, or
replace it with an organization-approved renewable credential when one is
available.

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
are reused by path and DA modification time, avoiding repeated PDF downloads.
