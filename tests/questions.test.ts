import { describe, expect, it } from "@effect/vitest"
import type { PracticeTest } from "../src/domain.ts"
import { questionsForPracticeTest } from "../src/questions.ts"

const practiceTests: ReadonlyArray<PracticeTest> = [4, 5, 6, 7, 8, 9, 10, 11]

describe("SAT question data", () => {
  it("contains every multiple-choice question and no grid-ins for all practice tests", () => {
    for (const practiceTest of practiceTests) {
      const questions = questionsForPracticeTest(practiceTest)
      expect(questions, `Practice Test ${practiceTest}`).toHaveLength(106)
      expect(questions.filter((question) => question.subject === "Reading and Writing" && question.module === 1)).toHaveLength(33)
      expect(questions.filter((question) => question.subject === "Reading and Writing" && question.module === 2)).toHaveLength(33)
      expect(questions.filter((question) => question.subject === "Math" && question.module === 1)).toHaveLength(20)
      expect(questions.filter((question) => question.subject === "Math" && question.module === 2)).toHaveLength(20)
    }
  })

  it("has stable unique ids, four non-empty options, and clean prompts", () => {
    for (const practiceTest of practiceTests) {
      const questions = questionsForPracticeTest(practiceTest)
      expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
      for (const question of questions) {
        expect(question.prompt.length, question.id).toBeGreaterThan(20)
        expect(question.prompt).not.toContain("DIRECTIONS")
        expect(Object.values(question.options)).toHaveLength(4)
        expect(Object.values(question.options).every((option) => option.length > 0)).toBe(true)
      }
    }
  })
})
