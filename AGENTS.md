# Learning more about Effect

This repository uses the Effect Typescript library.

Before writing any Effect code, first read `node_modules/effect/AGENTS.md`
**completely**, and follow the links in the file when required.

If you need to learn more about particular Effect apis and concepts that the
guide doesn't cover, search through the source code in `node_modules/effect/src`.

## Effect Best Practices

**IMPORTANT:** Always consult effect-solutions before writing Effect code.

Resolve the `effect-solutions` command (it may be installed in several places):

- **Local (npm):** `bunx effect-solutions` / `npx effect-solutions` if it's in the project's dependencies.
- **mise:** `mise exec -- effect-solutions` (or just `effect-solutions` if mise has shimmed it onto `PATH`).
- **Global:** `effect-solutions` directly if installed globally.

Then:

1. Run `effect-solutions list` to see available guides
2. Run `effect-solutions show <topic>...` for relevant patterns (supports multiple topics)
3. Search `~/.local/share/effect-solutions/effect` for real implementations

Topics: quick-start, project-setup, tsconfig, basics, services-and-layers, data-modeling, error-handling, config, testing, cli.

Never guess at Effect patterns - check the guide first.
