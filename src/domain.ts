import { Effect, Schema } from "effect"

export const AnswerLabel = Schema.Literals(["A", "B", "C", "D"])
export type AnswerLabel = typeof AnswerLabel.Type

export const Subject = Schema.Literals(["Reading and Writing", "Math"])
export type Subject = typeof Subject.Type

export const TestScope = Schema.Literals(["all", "rw-1", "rw-2", "math-1", "math-2"])
export type TestScope = typeof TestScope.Type

export class SatQuestion extends Schema.Class<SatQuestion>("SatQuestion")({
  id: Schema.String,
  subject: Subject,
  module: Schema.Literals([1, 2]),
  number: Schema.Int,
  prompt: Schema.String,
  options: Schema.Struct({
    A: Schema.String,
    B: Schema.String,
    C: Schema.String,
    D: Schema.String,
  }),
  answer: AnswerLabel,
  hasVisual: Schema.Boolean,
}) {}

export const RunRequest = Schema.Struct({
  scope: TestScope.pipe(Schema.withDecodingDefaultKey(Effect.succeed("all" as const))),
})

export class StartedEvent extends Schema.TaggedClass<StartedEvent>()("started", {
  total: Schema.Int,
  excludedGridIns: Schema.Int,
  batchSize: Schema.Int,
}) {}

export class ThinkingEvent extends Schema.TaggedClass<ThinkingEvent>()("thinking", {
  ids: Schema.Array(Schema.String),
}) {}

export class AnswerEvent extends Schema.TaggedClass<AnswerEvent>()("answer", {
  id: Schema.String,
  label: AnswerLabel,
  expected: AnswerLabel,
  correct: Schema.Boolean,
  confidence: Schema.Finite,
  probabilities: Schema.Record(Schema.String, Schema.Finite),
  inputTokens: Schema.optional(Schema.Finite),
  outputTokens: Schema.optional(Schema.Finite),
  batchDurationMs: Schema.Finite,
}) {}

export class CompletedEvent extends Schema.TaggedClass<CompletedEvent>()("completed", {
  total: Schema.Int,
  correct: Schema.Int,
  accuracy: Schema.Finite,
  inputTokens: Schema.Finite,
  outputTokens: Schema.Finite,
}) {}

export class FailedEvent extends Schema.TaggedClass<FailedEvent>()("failed", {
  message: Schema.String,
}) {}

export const RunEvent = Schema.Union([StartedEvent, ThinkingEvent, AnswerEvent, CompletedEvent, FailedEvent])
export type RunEvent = typeof RunEvent.Type
