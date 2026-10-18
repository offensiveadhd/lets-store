# lets-store

A community **store** for [lets](https://github.com/offensiveadhd/lets): a git
repository whose `index.json` lists *uniques* — rich interactive windows that
`lets` opens in a browser pane so a human can talk to Claude graphically.

A unique is a STATIC web app: plain HTML, ES-module JS and CSS. No build step,
no CDN, no server-side code. Each unique speaks the LIP protocol (see
`protocol/LIP.md` in the lets repo) through two SDK files the host serves at
`/sdk/lets-client.js` and `/sdk/lets-shell.js`. Because the host never executes
unique code — it only serves static files and routes JSON envelopes —
third-party uniques are safe to install straight from a git URL.

The look of the whole ecosystem is "deep violet": dark purple backgrounds,
soft violet/magenta glows, rounded everything. Stores stay out of the way and
just point at repos; the branding lives in the uniques themselves.

## Adding this store

In Claude Code (with the lets plugin loaded):

    /lets store

and pick `lets-store`, or ask Claude to use the `store add_store` tool:

    store add_store { "name": "lets-store", "repo": "https://github.com/offensiveadhd/lets-store.git" }

Then install any listed unique by name, e.g. `graph`, and open it in a window.

## The index

`index.json` is the whole store. Every entry has these fields:

| Field | Meaning |
|---|---|
| `name` | Unique id, `^[a-z][a-z0-9-]{1,31}$`, must match the unique's manifest `name`. Unique within the index. |
| `title` | Human title shown in listings. |
| `description` | One line: what the human does with it. |
| `repo` | Git URL the host clones from. MUST be `https://…`, `git@…` or `ssh://…`. |
| `path` | Folder inside the repo that contains the unique's `unique.json` (empty string = repo root). |
| `ref` | Branch or tag to track (default `main`). |
| `sha` | Optional commit pin. When present, the host clones exactly this commit instead of moving with `ref`. |
| `manifestSha256` | Optional SHA-256 of the unique's `unique.json` file — lets the host detect a manifest that changed since review. |
| `verified` | See the policy below. `true` = reviewed by a store maintainer. |
| `tags` | Free-form discovery tags. |
| `author` | GitHub handle of the unique's author. |

## What "verified" means

An entry marked `"verified": true` has had its manifest reviewed by a store
maintainer, who checked that:

- the manifest validates against the LIP unique schema (`unique.schema.json`);
- the unique is static-only: HTML/JS/CSS, ES modules, no build step, no
  executables, no binaries, no network CDN references;
- every event/command type declared starts with a domain the unique owns
  (no reserved `lip.*`, `session.*`, `entity.*`, `chat.*`, `component.*`,
  `media.*`, `ui.*` domains);
- every permission it needs (`fs.write`, `net`) is declared in the manifest,
  so the host can show the user what the unique may do before it is served.

`verified` is a review mark, not a cryptographic guarantee. Users still see the
manifest and its permissions when they install. Pinning `sha` (and ideally
`manifestSha256`) freezes the reviewed content so a later push to the branch
cannot silently change what was reviewed.

## Submitting a unique

1. Build your unique as its own git repo (or a folder in one) — see the
   `lets-unique-template` repo for a minimal working example.
2. Validate the manifest with the lets engine:

       node <lets>/engine/bin/lets.mjs validate <your-unique-dir>

3. Fork this store, add an entry to `index.json` (keep entries sorted by
   `name`), update the top-level `updated` date.
4. Run the store validator:

       npm run validate

5. Open a PR. The checklist in `CONTRIBUTING.md` must be satisfied; CI runs
   `node scripts/validate.mjs` on every push and PR.

New entries land unverified (`"verified": false` or omitted). A maintainer
reviews the manifest and flips the flag in a follow-up commit.

## Security model (summary)

- Uniques are **static** — the host serves files, never executes them.
- Everything is served from **loopback** with a per-host random token; pages
  get a CSP of `default-src 'self'`, so no external CDN, no inline exfiltration.
- The host **never runs unique code server-side**; all logic runs in the
  browser pane and talks LIP JSON over loopback HTTP/SSE.
- Permissions (`fs.write`, `net`) are declared in the manifest, validated
  before a unique is served, and enforced by the host: uploads land only under
  `~/.lets/uploads/<unique>/` and are size-capped.
- Message types are namespaced by domain; a unique cannot forge another
  unique's or the shell's messages.

See `protocol/LIP.md` in the lets repo for the full protocol and threat model.

## Repo layout

    index.json                     the store itself
    schema/store-index.schema.json JSON Schema for the index
    scripts/validate.mjs           zero-dependency validator (schema + invariants)
    .github/workflows/validate.yml  CI: validate on every push/PR (Node 20)

## License

MIT — see `LICENSE`.
