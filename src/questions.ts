import { Schema } from "effect"
import test4 from "./generated/sat-4.json" with { type: "json" }
import test5 from "./generated/sat-5.json" with { type: "json" }
import test6 from "./generated/sat-6.json" with { type: "json" }
import test7 from "./generated/sat-7.json" with { type: "json" }
import test8 from "./generated/sat-8.json" with { type: "json" }
import test9 from "./generated/sat-9.json" with { type: "json" }
import test10 from "./generated/sat-10.json" with { type: "json" }
import test11 from "./generated/sat-11.json" with { type: "json" }
import descriptions4 from "./generated/visual-descriptions/sat-4.json" with { type: "json" }
import descriptions5 from "./generated/visual-descriptions/sat-5.json" with { type: "json" }
import descriptions6 from "./generated/visual-descriptions/sat-6.json" with { type: "json" }
import descriptions7 from "./generated/visual-descriptions/sat-7.json" with { type: "json" }
import descriptions8 from "./generated/visual-descriptions/sat-8.json" with { type: "json" }
import descriptions9 from "./generated/visual-descriptions/sat-9.json" with { type: "json" }
import descriptions10 from "./generated/visual-descriptions/sat-10.json" with { type: "json" }
import descriptions11 from "./generated/visual-descriptions/sat-11.json" with { type: "json" }
import corrections4 from "./generated/math-corrections/sat-4.json" with { type: "json" }
import corrections5 from "./generated/math-corrections/sat-5.json" with { type: "json" }
import corrections6 from "./generated/math-corrections/sat-6.json" with { type: "json" }
import corrections7 from "./generated/math-corrections/sat-7.json" with { type: "json" }
import corrections8 from "./generated/math-corrections/sat-8.json" with { type: "json" }
import corrections9 from "./generated/math-corrections/sat-9.json" with { type: "json" }
import corrections10 from "./generated/math-corrections/sat-10.json" with { type: "json" }
import corrections11 from "./generated/math-corrections/sat-11.json" with { type: "json" }
import failureCorrections4 from "./generated/question-corrections/sat-4.json" with { type: "json" }
import failureCorrections5 from "./generated/question-corrections/sat-5.json" with { type: "json" }
import failureCorrections6 from "./generated/question-corrections/sat-6.json" with { type: "json" }
import failureCorrections7 from "./generated/question-corrections/sat-7.json" with { type: "json" }
import failureCorrections8 from "./generated/question-corrections/sat-8.json" with { type: "json" }
import failureCorrections9 from "./generated/question-corrections/sat-9.json" with { type: "json" }
import failureCorrections10 from "./generated/question-corrections/sat-10.json" with { type: "json" }
import failureCorrections11 from "./generated/question-corrections/sat-11.json" with { type: "json" }
import { SatQuestion, type PracticeTest } from "./domain.ts"

const decodeQuestions = Schema.decodeUnknownSync(Schema.Array(SatQuestion))

interface QuestionCorrection {
  readonly prompt: string
  readonly options: Readonly<Record<"A" | "B" | "C" | "D", string>>
}

const withCorrections = (
  questions: ReadonlyArray<Record<string, unknown>>,
  corrections: Readonly<Record<string, QuestionCorrection>>,
) => questions.map((question) => {
  const correction = typeof question.id === "string" ? corrections[question.id] : undefined
  return correction === undefined ? question : { ...question, ...correction }
})

const withVisualDescriptions = (
  questions: ReadonlyArray<Record<string, unknown>>,
  descriptions: Readonly<Record<string, string>>,
) => questions.map((question) => ({
  ...question,
  ...(typeof question.id === "string" && descriptions[question.id] !== undefined
    ? { visualDescription: descriptions[question.id] }
    : {}),
}))

const questionsByPracticeTest: Readonly<Record<PracticeTest, ReadonlyArray<SatQuestion>>> = {
  4: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test4, corrections4), failureCorrections4), descriptions4)),
  5: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test5, corrections5), failureCorrections5), descriptions5)),
  6: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test6, corrections6), failureCorrections6), descriptions6)),
  7: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test7, corrections7), failureCorrections7), descriptions7)),
  8: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test8, corrections8), failureCorrections8), descriptions8)),
  9: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test9, corrections9), failureCorrections9), descriptions9)),
  10: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test10, corrections10), failureCorrections10), descriptions10)),
  11: decodeQuestions(withVisualDescriptions(withCorrections(withCorrections(test11, corrections11), failureCorrections11), descriptions11)),
}

export const questionsForPracticeTest = (practiceTest: PracticeTest): ReadonlyArray<SatQuestion> =>
  questionsByPracticeTest[practiceTest]
