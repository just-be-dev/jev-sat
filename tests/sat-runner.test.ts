import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { DecisionModel } from "effect/unstable/ai"
import type { RunEvent } from "../src/domain.ts"
import { questionsForPracticeTest } from "../src/questions.ts"
import { runTest } from "../src/sat-runner.ts"

describe("SAT runner", () => {
  it.effect("streams batch activity, every answer, and an independently scored completion", () => {
    const questions = questionsForPracticeTest(4)
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

  it.effect("sends visual descriptions to Jev as part of the question state", () => {
    const question = questionsForPracticeTest(4).find((candidate) => candidate.hasVisual)!
    let receivedInput: unknown
    const model = Layer.effect(
      DecisionModel.DecisionModel,
      DecisionModel.make({
        decide: ({ decisions, state }) => Effect.sync(() => {
          receivedInput = state
          return {
            answers: Object.fromEntries(Object.keys(decisions).map((id) => [id, {
              _tag: "Classify" as const,
              label: question.answer,
              confidence: 1,
              probabilities: { A: 1, B: 0, C: 0, D: 0 },
            }])),
            usage: { inputTokens: 1, outputTokens: 1 },
          }
        }),
      }),
    )

    return Effect.gen(function*() {
      yield* runTest([question], () => Effect.void)
      expect(receivedInput).toEqual({
        questions: [{
          id: question.id,
          prompt: question.prompt,
          visualDescription: question.visualDescription,
        }],
      })
    }).pipe(Effect.provide(model))
  })
})
