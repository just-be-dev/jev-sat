import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import { Effect } from "effect"

export const Worker = Cloudflare.Worker("JevSatWorker", {
  name: "jev-sat",
  main: "./src/worker.ts",
  access: {
    name: "Jev SAT",
    sessionDuration: "24h",
    policies: [
      {
        name: "Cloudflare account members",
        decision: "allow",
        include: [{ cloudflareAccountMember: {} }],
      },
    ],
  },
  assets: {
    directory: "./public",
    runWorkerFirst: ["/api/*"],
  },
})

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
