import { Effect, Schema } from "effect"
import type { WorkerEnv } from "../alchemy.run.ts"
import { layer as cloudflareJevLayer, type JevBinding } from "./cloudflare-jev.ts"
import { FailedEvent, RunRequest, type RunEvent } from "./domain.ts"
import { questions, selectQuestions } from "./questions.ts"
import { runTest } from "./sat-runner.ts"

interface WorkerContext {
  readonly waitUntil: (promise: Promise<unknown>) => void
}

const encoder = new TextEncoder()

const json = (value: unknown, status = 200): Response => Response.json(value, {
  status,
  headers: { "cache-control": "no-store" },
})

const eventLine = (event: RunEvent): Uint8Array => encoder.encode(`${JSON.stringify(event)}\n`)

const decodeRunRequest = (request: Request) => Effect.tryPromise({
  try: () => request.json(),
  catch: () => undefined,
}).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(RunRequest)),
)

const streamRun = (request: Request, env: WorkerEnv, context: WorkerContext): Response => {
  const stream = new TransformStream<Uint8Array, Uint8Array>()
  const writer = stream.writable.getWriter()
  const emit = (event: RunEvent) => Effect.promise(() => writer.write(eventLine(event)))

  const program = Effect.gen(function*() {
    const { scope } = yield* decodeRunRequest(request)
    yield* runTest(selectQuestions(scope), emit)
  }).pipe(
    Effect.provide(cloudflareJevLayer(env.AI as unknown as JevBinding)),
    Effect.catch((cause) => emit(new FailedEvent({
      message: cause instanceof Error ? cause.message : String(cause),
    }))),
    Effect.ensuring(Effect.promise(() => writer.close())),
  )

  context.waitUntil(Effect.runPromise(program))
  return new Response(stream.readable, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-content-type-options": "nosniff",
    },
  })
}

export default {
  fetch(request: Request, env: WorkerEnv, context: WorkerContext): Response {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/api/test") {
      return json({
        title: "SAT Practice Test 4",
        totalQuestions: 120,
        multipleChoiceQuestions: questions.length,
        excludedGridIns: 14,
        model: "typesafe/jev via Cloudflare Workers AI",
        questions: questions.map(({ answer: _, ...question }) => question),
      })
    }
    if (request.method === "POST" && url.pathname === "/api/run") {
      return streamRun(request, env, context)
    }
    return json({ error: "Not found" }, 404)
  },
}
