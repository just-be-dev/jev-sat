# Jev takes the SAT

An Effect 4 application that streams TypeSafe Jev's progress through the multiple-choice questions in official SAT Practice Test 4. It runs on Cloudflare Workers, routes inference through Cloudflare AI Gateway, and deploys with Alchemy.

The source test has 120 questions. Jev evaluates the 106 fixed-choice questions. The 14 student-produced math responses are reported but excluded because a decision model selects among criteria rather than generating answers.

## Run locally

Prerequisites:

- Bun 1.4.2
- `pdftotext` from Poppler, only if regenerating `src/generated/sat.json`
- A Cloudflare account authenticated for Alchemy local development

```sh
bun install
bun run test
bun run typecheck
bun run dev
```

Alchemy prints the local URL. The Worker runs locally while its Workers AI binding calls `typesafe/jev` remotely. Those calls use the account's `default` AI Gateway and appear in its logs.

## Data extraction

The generated question set is checked in. Rebuild it from the PDFs and markdown answer explanations under `resources/` with:

```sh
bun run extract:sat
```

The extractor validates all 120 answer explanations and emits the 106 questions with four answer choices. Questions that depend on a graph, table, or figure are marked in the UI because PDF text extraction can omit visual detail.

## Deploy

```sh
bun run deploy
```

This creates a Cloudflare Worker, uploads `public/` as static assets, binds Workers AI as `env.AI`, and protects the Worker and its preview URLs with Cloudflare Access. The Access policy allows members of the Cloudflare account and issues 24-hour sessions. No TypeSafe API key is needed.

Destroy the Alchemy-managed stack with `bun run destroy`.
