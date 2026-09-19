import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { DecisionModel } from "effect/unstable/ai"
import type { RunEvent } from "../src/domain.ts"
import { questions } from "../src/questions.ts"
import { runTest } from "../src/sat-runner.ts"

describe("SAT runner", () => {
  it.effect("streams batch activity, every answer, and an independently scored completion", () => {
    const selected = questions.slice(0, 5)
    const expected = new Map(selected.map((question) => [question.id, question.answer]))
    const model = Layer.effect(
      DecisionModel.DecisionModel,
      DecisionModel.make({
        decide: ({ decisions }) => Effect.succeed({
          answers: Object.fromEntries(Object.keys(decisions).map((id) => {
            const label = expected.get(id)!
            return [id, {
              _tag: "Classify" as const,
              label,
              confidence: 0.9,
              probabilities: { A: label === "A" ? 1 : 0, B: label === "B" ? 1 : 0, C: label === "C" ? 1 : 0, D: label === "D" ? 1 : 0 },
            }]
          })),
          usage: { inputTokens: 40, outputTokens: 8 },
        }),
      }),
    )
    const events: Array<RunEvent> = []

    return Effect.gen(function*() {
      yield* runTest(selected, (event) => Effect.sync(() => void events.push(event)))
      expect(events.filter((event) => event._tag === "thinking")).toHaveLength(2)
      expect(events.filter((event) => event._tag === "answer")).toHaveLength(5)
      expect(events.at(-1)).toMatchObject({
        _tag: "completed",
        total: 5,
        correct: 5,
        accuracy: 1,
        inputTokens: 80,
        outputTokens: 16,
      })
    }).pipe(Effect.provide(model))
  })
})
