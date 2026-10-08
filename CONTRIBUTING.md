# Contributing to lets-store

Every PR adds or edits entries in `index.json`. Keep this checklist in the PR
description and tick every box before requesting review.

## Checklist for a new entry

- [ ] The unique's manifest validates:
      `node <lets>/engine/bin/lets.mjs validate <unique-dir>` exits 0
      (replace `<lets>` with your checkout of the lets repo, `<unique-dir>`
      with a local copy of the unique folder, e.g. from the pinned commit).
- [ ] `GUIDE.md` exists, follows LIP §7, and is under 1,200 words.
- [ ] The unique is static-only: HTML/JS/CSS ES modules, no build step,
      no executables or binary blobs in the repo, no CDN references.
- [ ] Every event/command type in the manifest starts with a domain the
      unique owns (no reserved domains: `lip`, `session`, `entity`, `chat`,
      `component`, `media`, `ui`).
- [ ] Permissions (`fs.write`, `net`) are declared in the manifest and match
      what the unique actually does.
- [ ] `repo` is an `https://`, `git@` or `ssh://` git URL.
- [ ] `name` is unique in the index and matches the manifest's `name`.
- [ ] Pinning: `sha` (commit) is recommended for review; if the entry tracks
      a moving `ref`, say why in the PR.
- [ ] The unique states its license (MIT-compatible preferred).
- [ ] `node scripts/validate.mjs` passes locally (`npm run validate`).
- [ ] Top-level `updated` field reflects today's date.

## After review

A maintainer re-checks the manifest at the pinned commit and flips
`"verified": true` in a follow-up commit if everything holds.

## Style

- Keep `index.json` entries sorted by `name`.
- One entry per unique; a new version of the same unique updates the existing
  entry (bump `sha`, keep `name`).
- Descriptions are one line, human-first: what the human does with it.
