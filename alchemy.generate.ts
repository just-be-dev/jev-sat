import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export const GeneratorWorker = Cloudflare.Worker("JevSatGeneratorWorker", {
  name: "jev-sat-generator",
  main: "./scripts/generate-worker.ts",
  dev: {
    port: 1339,
    strictPort: true,
  },
  env: {
    AI: Cloudflare.Workers.AI(),
  },
})

export type GeneratorWorkerEnv = Cloudflare.InferEnv<typeof GeneratorWorker>

export default Alchemy.Stack(
  "jev-sat-generator",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function*() {
    const worker = yield* GeneratorWorker
    return { url: worker.url }
  }),
)
