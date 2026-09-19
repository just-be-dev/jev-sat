# Jev takes the SAT

An Effect 4 application that replays TypeSafe Jev's progress through the multiple-choice questions in official SAT Practice Tests 4–11. Each exam has five prerecorded runs; the UI chooses one randomly, so visitors never trigger paid inference.

Each source test has 120 questions. Jev evaluates the 106 fixed-choice questions. The 14 student-produced math responses are reported but excluded because a decision model selects among criteria rather than generating answers.

## Run locally

Prerequisites:

- Bun 1.4.2
- `pdftotext` from Poppler, only if regenerating the normalized question files

```sh
bun install
bun run test
bun run typecheck
bun run dev
```

Alchemy prints the local URL. Replaying runs locally or in production makes no model requests.

## Data extraction

The generated question sets are checked in. Rebuild them from the question and answer PDFs under `resources/` with:

```sh
bun run extract:sat
```

The extractor validates all 120 answer explanations for each exam and emits the 106 questions with four answer choices. Questions that depend on a graph, table, or figure are marked in the UI because PDF text extraction can omit visual detail.

## Generate runs

Generating runs requires an Alchemy-authenticated Cloudflare account and incurs Workers AI charges. The task starts a local-only generator Worker and writes any missing runs under `resources/runs/`:

```sh
mise run generate-runs
```

Existing files are skipped to prevent accidental repeat charges. Delete the run files you intend to replace before running the task.

## Deploy

```sh
bun run deploy
```

This creates a public Cloudflare Worker, uploads `public/` as static assets, and enables Workers Cache for the stable test and prerecorded-run API responses. The production Worker has no Workers AI binding.

Destroy the Alchemy-managed stack with `bun run destroy`.
