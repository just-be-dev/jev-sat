import { describe, expect, it } from "@effect/vitest"
import type { PracticeTest } from "../src/domain.ts"
import { runsForPracticeTest } from "../src/runs.ts"

const practiceTests: ReadonlyArray<PracticeTest> = [4, 5, 6, 7, 8, 9, 10, 11]

describe("prerecorded SAT runs", () => {
  it("contains five complete, independently scored runs for every practice test", () => {
    for (const practiceTest of practiceTests) {
      const runs = runsForPracticeTest(practiceTest)
      expect(runs, `Practice Test ${practiceTest}`).toHaveLength(5)
      for (const run of runs) {
        const answers = run.filter((event) => event._tag === "answer")
        const completed = run.at(-1)
        expect(run[0]).toMatchObject({ _tag: "started", total: 106 })
        expect(answers).toHaveLength(106)
        expect(new Set(answers.map((event) => event.id)).size).toBe(106)
        expect(completed).toMatchObject({
          _tag: "completed",
          total: 106,
          correct: answers.filter((event) => event.correct).length,
        })
      }
    }
  })
})
