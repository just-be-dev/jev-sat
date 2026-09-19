import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { Decision, DecisionModel } from "effect/unstable/ai"
import { layer, type JevBinding } from "../src/cloudflare-jev.ts"

describe("Cloudflare Jev decision model", () => {
  it.effect("routes through AI Gateway and converts TypeSafe choice answers", () => {
    let call: ReadonlyArray<unknown> | undefined
    const binding: JevBinding = {
      run: (model, input, options) => {
        call = [model, input, options]
        return Promise.resolve({
          state: "Completed",
          result: {
            model: "jev-1.13.0",
            answers: {
              answer: {
                type: "choice",
                choice: "B",
                confidence: 0.8,
                probabilities: { A: 0.1, B: 0.8, C: 0.04, D: 0.05 },
              },
            },
            usage: { input_tokens: 100, output_tokens: 20 },
          },
          gatewayMetadata: { keySource: "Unified" },
        })
      },
    }
    const definition = Decision.make({
      input: Schema.String,
      decisions: {
        answer: Decision.classify({
          instructions: "Choose an answer",
          criteria: { A: "one", B: "two", C: "three", D: "four" },
        }),
      },
    })

    return Effect.gen(function*() {
      const result = yield* DecisionModel.decide(definition, { input: "question" })
      expect(result.answers.answer.label).toBe("B")
      expect(result.answers.answer.confidence).toBe(0.8)
      expect(result.answers.answer.probabilities.B).toBeCloseTo(0.8 / 0.99, 10)
      expect(Object.values(result.answers.answer.probabilities).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10)
      expect(result.usage.inputTokens).toBe(100)
      expect(call?.[0]).toBe("typesafe/jev")
      expect(call?.[2]).toMatchObject({ gateway: { id: "default", collectLog: true } })
    }).pipe(Effect.provide(layer(binding)))
  })
})
