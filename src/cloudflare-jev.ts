import { TypeSafeSchema } from "@effect/ai-typesafe"
import { Effect, Layer, Schema } from "effect"
import { AiError, DecisionModel } from "effect/unstable/ai"

interface JevBinding {
  readonly run: (
    model: "typesafe/jev",
    input: unknown,
    options: {
      readonly gateway: {
        readonly id: string
        readonly collectLog: boolean
        readonly metadata: Readonly<Record<string, string>>
        readonly retries: {
          readonly maxAttempts: 1 | 2 | 3 | 4 | 5
          readonly backoff: "exponential"
        }
      }
    },
  ) => Promise<unknown>
}

const aiError = (method: string, description: string): AiError.AiError =>
  AiError.make({
    module: "CloudflareJev",
    method,
    reason: new AiError.UnknownError({ description }),
  })

const invalidOutput = (description: string): AiError.AiError =>
  AiError.make({
    module: "CloudflareJev",
    method: "decide",
    reason: new AiError.InvalidOutputError({ description }),
  })

const CloudflareJevResponse = Schema.Union([
  TypeSafeSchema.SystemOneResponse,
  Schema.Struct({
    state: Schema.Literal("Completed"),
    result: TypeSafeSchema.SystemOneResponse,
  }),
])

const normalizeProbabilities = (
  probabilities: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> => {
  const values = Object.values(probabilities)
  const total = values.reduce((sum, probability) => sum + probability, 0)
  if (
    total === 0 ||
    Math.abs(total - 1) <= 1e-6 ||
    values.some((probability) => !Number.isFinite(probability) || probability < 0 || probability > 1)
  ) {
    return probabilities
  }
  const normalized: Record<string, number> = Object.create(null)
  for (const [label, probability] of Object.entries(probabilities)) {
    normalized[label] = probability / total
  }
  return normalized
}

export const layer = (ai: JevBinding): Layer.Layer<DecisionModel.DecisionModel> =>
  Layer.effect(
    DecisionModel.DecisionModel,
    DecisionModel.make({
      decide: Effect.fnUntraced(function*({ state, decisions }) {
        const questions: Record<string, typeof TypeSafeSchema.Question.Encoded> = Object.create(null)
        for (const [key, decision] of Object.entries(decisions)) {
          switch (decision._tag) {
            case "Classify":
              questions[key] = { type: "choice", instructions: decision.instructions, criteria: decision.criteria }
              break
            case "Rate":
              questions[key] = { type: "score", instructions: decision.instructions, criteria: decision.criteria }
              break
            case "Probability":
              questions[key] = { type: "noul", instructions: decision.instructions, criteria: decision.criteria }
              break
          }
        }

        const raw = yield* Effect.tryPromise({
          try: () => ai.run("typesafe/jev", { state, questions }, {
            gateway: {
              id: "default",
              collectLog: true,
              metadata: { application: "jev-sat" },
              retries: { maxAttempts: 3, backoff: "exponential" },
            },
          }),
          catch: (cause) => aiError("decide", cause instanceof Error ? cause.message : String(cause)),
        })
        const decoded = yield* Schema.decodeUnknownEffect(CloudflareJevResponse)(raw).pipe(
          Effect.mapError((error) => invalidOutput(error.message)),
        )
        const response = "result" in decoded ? decoded.result : decoded

        const answers: Record<string, DecisionModel.ProviderAnswer> = Object.create(null)
        for (const [key, decision] of Object.entries(decisions)) {
          const answer = response.answers[key]
          switch (answer?.type) {
            case "choice":
              answers[key] = {
                _tag: "Classify",
                label: answer.choice,
                probabilities: normalizeProbabilities(answer.probabilities),
                confidence: answer.confidence,
              }
              break
            case "score": {
              const levels = decision._tag === "Rate" ? decision.criteria : []
              const probabilities: Record<string, number> = Object.create(null)
              for (let index = 0; index < levels.length; index++) {
                const probability = answer.probabilities[String(index)]
                if (probability !== undefined) probabilities[levels[index]!] = probability
              }
              answers[key] = {
                _tag: "Rate",
                rating: answer.score,
                probabilities: normalizeProbabilities(probabilities),
                confidence: answer.confidence,
              }
              break
            }
            case "noul":
              answers[key] = { _tag: "Probability", probability: answer.noul }
              break
          }
        }

        return {
          answers,
          usage: {
            inputTokens: response.usage?.input_tokens,
            outputTokens: response.usage?.output_tokens,
          },
        }
      }),
    }),
  )

export type { JevBinding }
