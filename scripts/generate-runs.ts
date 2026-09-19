import { BunRuntime } from "@effect/platform-bun"
import { Effect, Schema } from "effect"
import { RunEvent, SatQuestion } from "../src/domain.ts"

const practiceTests = [4, 5, 6, 7, 8, 9, 10, 11] as const
const runsPerTest = 5

class GenerateRunsError extends Schema.TaggedError<GenerateRunsError>()("GenerateRunsError", {
  message: Schema.String,
}) {}

interface GeneratorServer {
  readonly child: ReturnType<typeof Bun.spawn>
  readonly url: string
}

const startGenerator = Effect.tryPromise({
  try: () => new Promise<GeneratorServer>((resolve, reject) => {
    const child = Bun.spawn(
      ["bunx", "alchemy", "dev", "alchemy.generate.ts", "--stage", "generate-runs", "--no-input"],
      { stdout: "pipe", stderr: "pipe", env: process.env },
    )
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("Timed out waiting for the local generator Worker"))
    }, 60_000)

    const read = async (stream: ReadableStream<Uint8Array>, error: boolean) => {
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
  ({ child }) => Effect.promise(async() => {
    child.kill()
    await child.exited
  }),
)

const loadQuestions = Effect.fn("loadQuestions")(function*(practiceTest: number) {
  const path = `src/generated/sat-${practiceTest}.json`
  const raw = yield* Effect.tryPromise({
    try: () => Bun.file(path).json(),
    catch: (cause) => new GenerateRunsError({ message: `Could not read ${path}: ${String(cause)}` }),
  })
  return yield* Schema.decodeUnknownEffect(Schema.Array(SatQuestion))(raw).pipe(
    Effect.mapError((error) => new GenerateRunsError({ message: `Invalid questions in ${path}: ${error.message}` })),
  )
})

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

const program = Effect.scoped(Effect.gen(function*() {
  const server = yield* generatorServer
  for (const practiceTest of practiceTests) {
    const questions = yield* loadQuestions(practiceTest)
    for (let run = 1; run <= runsPerTest; run++) {
      const output = `resources/runs/sat-practice-test-${practiceTest}-run-${run}.json`
      if (yield* Effect.promise(() => Bun.file(output).exists())) {
        yield* Effect.log(`Skipping existing ${output}`)
        continue
      }
      yield* Effect.log(`Generating Practice Test ${practiceTest}, run ${run} of ${runsPerTest}`)
      const events = yield* generateRun(server.url, questions)
      yield* Effect.tryPromise({
        try: () => Bun.write(output, `${JSON.stringify(events, null, 2)}\n`),
        catch: (cause) => new GenerateRunsError({ message: `Could not write ${output}: ${String(cause)}` }),
      })
      yield* Effect.log(`Wrote ${output}`)
    }
  }
}))

BunRuntime.runMain(program)
