import { Effect, Schema } from "effect"
import type { GeneratorWorkerEnv } from "../alchemy.generate.ts"
import { layer as cloudflareJevLayer, type JevBinding } from "../src/cloudflare-jev.ts"
import { RunEvent, SatQuestion, type RunEvent as RunEventType } from "../src/domain.ts"
import { runTest } from "../src/sat-runner.ts"

const GenerateRequest = Schema.Struct({
  questions: Schema.Array(SatQuestion),
})

class GenerateRequestError extends Schema.TaggedError<GenerateRequestError>()("GenerateRequestError", {
  cause: Schema.Defect(),
}) {}

const generate = Effect.fn("generate")(function*(request: Request, env: GeneratorWorkerEnv) {
  const input = yield* Effect.tryPromise({
    try: () => request.json(),
    catch: (cause) => new GenerateRequestError({ cause }),
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(GenerateRequest)))
  const events: Array<RunEventType> = []
  yield* runTest(input.questions, (event) => Effect.sync(() => void events.push(event))).pipe(
    Effect.provide(cloudflareJevLayer(env.AI as unknown as JevBinding)),
  )
  return yield* Schema.encodeEffect(Schema.Array(RunEvent))(events)
})

export default {
  async fetch(request: Request, env: GeneratorWorkerEnv): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/generate") {
      return Response.json({ error: "Not found" }, { status: 404 })
    }
    return Effect.runPromise(generate(request, env).pipe(
      Effect.map((events) => Response.json(events)),
      Effect.catch((error) => Effect.succeed(Response.json({ error: String(error) }, { status: 500 }))),
    ))
  },
}
