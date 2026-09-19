import { Clock, Effect, Schema } from "effect"
import { Decision, DecisionModel } from "effect/unstable/ai"
import {
  AnswerEvent,
  CompletedEvent,
  StartedEvent,
  ThinkingEvent,
  type AnswerLabel,
  type RunEvent,
  type SatQuestion,
} from "./domain.ts"

const batchSize = 4

const BatchInput = Schema.Struct({
  questions: Schema.Array(Schema.Struct({
    id: Schema.String,
    prompt: Schema.String,
  })),
})

const chunksOf = <A>(items: ReadonlyArray<A>, size: number): ReadonlyArray<ReadonlyArray<A>> => {
  const chunks: Array<ReadonlyArray<A>> = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export const makeDefinition = (batch: ReadonlyArray<SatQuestion>) => {
  const decisions: Record<string, Decision.Classify<AnswerLabel>> = Object.create(null)
  for (const question of batch) {
    decisions[question.id] = Decision.classify({
      instructions: `Choose the best answer to the SAT question in state.questions whose id is "${question.id}". Read its prompt carefully. Return exactly one answer label.`,
      criteria: question.options,
    })
  }
  return Decision.make({ input: BatchInput, decisions })
}

export const runTest = Effect.fn("runTest")(function*(
  selected: ReadonlyArray<SatQuestion>,
  emit: (event: RunEvent) => Effect.Effect<void, unknown>,
) {
  let correct = 0
  let inputTokens = 0
  let outputTokens = 0

  yield* emit(new StartedEvent({
    total: selected.length,
    excludedGridIns: selected.length === 106 ? 14 : selected.length === 20 ? 7 : 0,
    batchSize,
  }))

  for (const batch of chunksOf(selected, batchSize)) {
    yield* emit(new ThinkingEvent({ ids: batch.map((question) => question.id) }))
    const startedAt = yield* Clock.currentTimeMillis
    const definition = makeDefinition(batch)
    const result = yield* DecisionModel.decide(definition, {
      input: { questions: batch.map(({ id, prompt }) => ({ id, prompt })) },
    })
    const duration = (yield* Clock.currentTimeMillis) - startedAt
    inputTokens += result.usage.inputTokens ?? 0
    outputTokens += result.usage.outputTokens ?? 0

    for (let index = 0; index < batch.length; index++) {
      const question = batch[index]!
      const answer = result.answers[question.id]!
      const isCorrect = answer.label === question.answer
      if (isCorrect) correct++
      yield* emit(new AnswerEvent({
        id: question.id,
        label: answer.label,
        expected: question.answer,
        correct: isCorrect,
        confidence: answer.confidence ?? 0,
        probabilities: answer.probabilities,
        inputTokens: index === 0 ? result.usage.inputTokens : undefined,
        outputTokens: index === 0 ? result.usage.outputTokens : undefined,
        batchDurationMs: duration,
      }))
    }
  }

  yield* emit(new CompletedEvent({
    total: selected.length,
    correct,
    accuracy: selected.length === 0 ? 0 : correct / selected.length,
    inputTokens,
    outputTokens,
  }))
})
