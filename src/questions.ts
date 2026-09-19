import { Schema } from "effect"
import rawQuestions from "./generated/sat.json" with { type: "json" }
import { SatQuestion, type TestScope } from "./domain.ts"

export const questions = Schema.decodeUnknownSync(Schema.Array(SatQuestion))(rawQuestions)

export const selectQuestions = (scope: TestScope): ReadonlyArray<SatQuestion> => {
  if (scope === "all") return questions
  const [subject, module] = scope.split("-")
  return questions.filter((question) =>
    question.module === Number(module) &&
    (subject === "rw" ? question.subject === "Reading and Writing" : question.subject === "Math")
  )
}
