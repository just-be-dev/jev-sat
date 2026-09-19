import { describe, expect, it } from "@effect/vitest"
import { questions, selectQuestions } from "../src/questions.ts"

describe("SAT question data", () => {
  it("contains every multiple-choice question and no grid-ins", () => {
    expect(questions).toHaveLength(106)
    expect(selectQuestions("rw-1")).toHaveLength(33)
    expect(selectQuestions("rw-2")).toHaveLength(33)
    expect(selectQuestions("math-1")).toHaveLength(20)
    expect(selectQuestions("math-2")).toHaveLength(20)
  })

  it("has stable unique ids, four non-empty options, and clean prompts", () => {
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length)
    for (const question of questions) {
      expect(question.prompt.length).toBeGreaterThan(20)
      expect(question.prompt).not.toContain("DIRECTIONS")
      expect(Object.values(question.options)).toHaveLength(4)
      expect(Object.values(question.options).every((option) => option.length > 0)).toBe(true)
    }
  })
})
