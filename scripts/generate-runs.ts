import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import { RunEvent, SatQuestion } from "../src/domain.ts"
import audit4 from "../src/generated/failure-audits/sat-4.json" with { type: "json" }
import audit5 from "../src/generated/failure-audits/sat-5.json" with { type: "json" }
import audit6 from "../src/generated/failure-audits/sat-6.json" with { type: "json" }
import audit7 from "../src/generated/failure-audits/sat-7.json" with { type: "json" }
import audit8 from "../src/generated/failure-audits/sat-8.json" with { type: "json" }
import audit9 from "../src/generated/failure-audits/sat-9.json" with { type: "json" }
import audit10 from "../src/generated/failure-audits/sat-10.json" with { type: "json" }
import audit11 from "../src/generated/failure-audits/sat-11.json" with { type: "json" }
import { questionsForPracticeTest } from "../src/questions.ts"

const practiceTests = [4, 5, 6, 7, 8, 9, 10, 11] as const
const runsPerTest = 5
const regeneration = process.argv.includes("--visuals-only")
  ? "visual"
  : process.argv.includes("--math-only")
  ? "math"
  : process.argv.includes("--audited-defects")
  ? "audited defect"
  : undefined

const failureAuditsByPracticeTest: Readonly<Record<
  (typeof practiceTests)[number],
  Readonly<Record<string, { readonly classification: string }>>
>> = {
  4: audit4,
  5: audit5,
  6: audit6,
  7: audit7,
  8: audit8,
  9: audit9,
  10: audit10,
  11: audit11,
} as const

class GenerateRunsError extends Schema.TaggedError<GenerateRunsError>()("GenerateRunsError", {
  message: Schema.String,
}) {}

interface GeneratorServer {
  readonly child?: ReturnType<typeof Bun.spawn>
  readonly url: string
}

const startGenerator = Effect.tryPromise({
  try: () => process.env.JEV_GENERATOR_URL !== undefined
    ? Promise.resolve<GeneratorServer>({ url: process.env.JEV_GENERATOR_URL })
    : new Promise<GeneratorServer>((resolve, reject) => {
      const child = Bun.spawn(
        ["bunx", "alchemy", "dev", "alchemy.generate.ts", "--stage", "generate-runs", "--no-input"],
        { stdout: "pipe", stderr: "pipe", env: process.env },
      )
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) reject(new Error("Timed out waiting for the local generator Worker"))
      }, 60_000)

      const read = async(stream: ReadableStream<Uint8Array>, error: boolean) => {
        const reader = stream.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          if (error) process.stderr.write(text)
          else process.stdout.write(text)
          const match = text.match(/ready at (http:\/\/[^\s]+)/)
          if (match && !settled) {
            settled = true
            clearTimeout(timer)
            resolve({ child, url: match[1]! })
          }
        }
      }

      void read(child.stdout, false)
      void read(child.stderr, true)
      void child.exited.then((exitCode) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          reject(new Error(`Local generator Worker exited with code ${exitCode}`))
        }
      })
    }),
  catch: (cause) => new GenerateRunsError({ message: String(cause) }),
})

const generatorServer = Effect.acquireRelease(
  startGenerator,
  ({ child }) => child === undefined
    ? Effect.void
    : Effect.promise(async() => {
      child.kill()
      await child.exited
    }),
)

const generateRun = Effect.fn("generateRun")(function*(
  url: string,
  questions: ReadonlyArray<SatQuestion>,
) {
  const response = yield* Effect.tryPromise({
    try: () => fetch(`${url}/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ questions }),
    }),
    catch: (cause) => new GenerateRunsError({ message: `Generator request failed: ${String(cause)}` }),
  })
  if (!response.ok) {
    const body = yield* Effect.promise(() => response.text())
    return yield* new GenerateRunsError({ message: `Generator returned ${response.status}: ${body}` })
  }
  const raw = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => new GenerateRunsError({ message: `Could not decode generator response: ${String(cause)}` }),
  })
  return yield* Schema.decodeUnknownEffect(Schema.Array(RunEvent))(raw).pipe(
    Effect.mapError((error) => new GenerateRunsError({ message: `Invalid generated run: ${error.message}` })),
  )
})

const loadRun = Effect.fn("loadRun")(function*(path: string) {
  const raw = yield* Effect.tryPromise({
    try: () => Bun.file(path).json(),
    catch: (cause) => new GenerateRunsError({ message: `Could not read ${path}: ${String(cause)}` }),
  })
  return yield* Schema.decodeUnknownEffect(Schema.Array(RunEvent))(raw).pipe(
    Effect.mapError((error) => new GenerateRunsError({ message: `Invalid existing run ${path}: ${error.message}` })),
  )
})

function mergeAnswers(
  existing: ReadonlyArray<RunEvent>,
  generated: ReadonlyArray<RunEvent>,
  expectedIds: ReadonlyArray<string>,
): ReadonlyArray<RunEvent> {
  const replacements = new Map(
    generated.filter((event) => event._tag === "answer").map((event) => [event.id, event]),
  )
  const missing = expectedIds.filter((id) => !replacements.has(id))
  if (missing.length > 0) {
    throw new GenerateRunsError({ message: `Generator returned no answer for: ${missing.join(", ")}` })
  }
  let correct = 0
  const merged = existing.map((event): RunEvent => {
    if (event._tag === "answer") {
      const replacement = replacements.get(event.id)
      if (replacement === undefined) {
        if (event.correct) correct++
        return event
      }
      replacements.delete(event.id)
      if (replacement.correct) correct++
      return {
        ...event,
        label: replacement.label,
        correct: replacement.correct,
        confidence: replacement.confidence,
        probabilities: replacement.probabilities,
        batchDurationMs: replacement.batchDurationMs,
      }
    }
    if (event._tag === "completed") {
      return { ...event, correct, accuracy: correct / event.total }
    }
    return event
  })
  if (replacements.size > 0) {
    throw new GenerateRunsError({
      message: `Generated answers were missing from the existing run: ${[...replacements.keys()].join(", ")}`,
    })
  }
  return merged
}

const program = Effect.scoped(Effect.gen(function*() {
  const server = yield* generatorServer
  for (const practiceTest of practiceTests) {
    const questions = questionsForPracticeTest(practiceTest)
    for (let run = 1; run <= runsPerTest; run++) {
      const output = `resources/runs/sat-practice-test-${practiceTest}-run-${run}.json`
      const exists = yield* Effect.promise(() => Bun.file(output).exists())
      if (exists && regeneration === undefined) {
        yield* Effect.log(`Skipping existing ${output}`)
        continue
      }
      if (regeneration !== undefined && !exists) {
        return yield* new GenerateRunsError({ message: `Cannot replace ${regeneration} answers because ${output} does not exist` })
      }
      const selected = regeneration === "visual"
        ? questions.filter((question) => question.hasVisual)
        : regeneration === "math"
        ? questions.filter((question) => question.subject === "Math")
        : regeneration === "audited defect"
        ? questions.filter((question) => {
          const audit = failureAuditsByPracticeTest[practiceTest][question.id]
          return audit !== undefined && audit.classification !== "legitimate"
        })
        : questions
      yield* Effect.log(
        `${regeneration === undefined ? "Generating" : `Regenerating ${regeneration} answers for`} Practice Test ${practiceTest}, run ${run} of ${runsPerTest}`,
      )
      const generated = yield* generateRun(server.url, selected)
      const events = regeneration === undefined
        ? generated
        : mergeAnswers(yield* loadRun(output), generated, selected.map((question) => question.id))
      yield* Effect.tryPromise({
        try: () => Bun.write(output, `${JSON.stringify(events, null, 2)}\n`),
        catch: (cause) => new GenerateRunsError({ message: `Could not write ${output}: ${String(cause)}` }),
      })
      yield* Effect.log(`Wrote ${output}`)
    }
  }
}))

BunRuntime.runMain(program)
