import { Schema } from "effect"
import test4 from "./generated/sat-4.json" with { type: "json" }
import test5 from "./generated/sat-5.json" with { type: "json" }
import test6 from "./generated/sat-6.json" with { type: "json" }
import test7 from "./generated/sat-7.json" with { type: "json" }
import test8 from "./generated/sat-8.json" with { type: "json" }
import test9 from "./generated/sat-9.json" with { type: "json" }
import test10 from "./generated/sat-10.json" with { type: "json" }
import test11 from "./generated/sat-11.json" with { type: "json" }
import { SatQuestion, type PracticeTest } from "./domain.ts"

const decodeQuestions = Schema.decodeUnknownSync(Schema.Array(SatQuestion))

const questionsByPracticeTest: Readonly<Record<PracticeTest, ReadonlyArray<SatQuestion>>> = {
  4: decodeQuestions(test4),
  5: decodeQuestions(test5),
  6: decodeQuestions(test6),
  7: decodeQuestions(test7),
  8: decodeQuestions(test8),
  9: decodeQuestions(test9),
  10: decodeQuestions(test10),
  11: decodeQuestions(test11),
}

export const questionsForPracticeTest = (practiceTest: PracticeTest): ReadonlyArray<SatQuestion> =>
  questionsByPracticeTest[practiceTest]
