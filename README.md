# Jev takes the SAT

An Effect 4 application that replays TypeSafe Jev's progress through the multiple-choice questions in official SAT Practice Tests 4–11. Each exam has five prerecorded runs; the UI chooses one randomly, so visitors never trigger paid inference.

Each source test has 120 questions. Jev evaluates the 106 fixed-choice questions. The 14 student-produced math responses are reported but excluded because a decision model selects among criteria rather than generating answers.

## Run locally

Prerequisites:

- Bun 1.4.2
- `curl`, only if refreshing the source PDFs
- `pdftotext`, `pdfinfo`, and `pdftocairo` from Poppler, only if regenerating the normalized question files and visual source pages

```sh
bun install
bun run test
bun run typecheck
bun run dev
```

Alchemy prints the local URL. Replaying runs locally or in production makes no model requests.

## Data extraction

Refresh the official College Board source PDFs with:

```sh
bun run download:sat
```

The generated question sets and visual source pages are checked in. Rebuild them from the question and answer PDFs under `resources/` with:

```sh
bun run extract:sat
```

The extractor validates all 120 answer explanations for each exam and emits the 106 questions with four answer choices. It also renders the relevant columns from the official PDF pages for questions that depend on a graph, table, figure, diagram, or visual answer choice.

Because PDF text extraction loses mathematical layout, the exact student-visible wording and choices for all multiple-choice Math questions are maintained as checked-in overlays under `src/generated/math-corrections/`. These overlays restore exponents, radicals, fractions, equation grouping, and page-boundary text after extraction.

The remaining failed questions were individually checked against the source PDFs and official explanations. Machine-readable findings are under `src/generated/failure-audits/`; additional text fixes found during that audit are under `src/generated/question-corrections/`.

Jev accepts text but not images. Each detected visual therefore has a checked-in factual description under `src/generated/visual-descriptions/`. The run generator includes that description in Jev's question state, while the replay UI includes the PDF crop for auditability. In the checked-in prerecorded runs, visual questions were regenerated with these descriptions and all Math questions were regenerated with the corrected text; nonvisual Reading and Writing answers retain their original results.

## Generate runs

Generating runs requires an Alchemy-authenticated Cloudflare account and incurs Workers AI charges. The task starts a local-only generator Worker and writes any missing runs under `resources/runs/`:

```sh
mise run generate-runs
```

Existing files are skipped to prevent accidental repeat charges. Delete the run files you intend to replace before running the task.

To rerun only questions with visual descriptions and merge their new answers into the existing runs:

```sh
mise run regenerate-visual-runs
```

This lower-cost path preserves the original replay order, nonvisual answers, and token totals, then recomputes each merged run's score.

After changing the Math correction overlays, rerun all multiple-choice Math questions and merge their answers with:

```sh
mise run regenerate-math-runs
```

## Deploy

```sh
bun run deploy
```

This creates a public Cloudflare Worker, uploads `public/` as static assets, and enables Workers Cache for the stable test and prerecorded-run API responses. The production Worker has no Workers AI binding.

Destroy the Alchemy-managed stack with `bun run destroy`.
