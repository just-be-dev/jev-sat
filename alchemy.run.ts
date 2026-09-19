import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export const Worker = Cloudflare.Worker("JevSatWorker", {
  name: "jev-sat",
  main: "./src/worker.ts",
  assets: {
    directory: "./public",
    runWorkerFirst: ["/api/*"],
  },
  env: {
    AI: Cloudflare.Workers.AI(),
  },
})

export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>

export default Alchemy.Stack(
  "jev-sat",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function*() {
    const worker = yield* Worker
    return { url: worker.url }
  }),
)
