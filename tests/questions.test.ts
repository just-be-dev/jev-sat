import { describe, expect, it } from "@effect/vitest"
import { existsSync } from "node:fs"
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
        expect(question.prompt.length, question.id).toBeGreaterThan(10)
        expect(question.prompt).not.toContain("DIRECTIONS")
        if (question.subject === "Math") {
          expect(question.prompt).not.toMatch(/Unauthorized\s*copying|CONTINUE|_J|[]/)
        }
        expect(Object.values(question.options)).toHaveLength(4)
        expect(Object.values(question.options).every((option) => option.length > 0)).toBe(true)
      }
    }
  })

  it("restores unambiguous notation for previously damaged math questions", () => {
    expect(questionsForPracticeTest(11).find((question) => question.id === "11-math-1-04")).toMatchObject({
      prompt: "8x² − 40 = 32\n\nWhat is the positive solution to the given equation?",
    })
    expect(questionsForPracticeTest(6).find((question) => question.id === "6-math-2-24")).toMatchObject({
      prompt: expect.stringContaining("f(x) = a√(x + b)"),
    })
    expect(questionsForPracticeTest(4).find((question) => question.id === "4-math-1-22")).toMatchObject({
      prompt: expect.stringContaining("2√2, 6√2, and √80"),
    })
  })

  it("applies corrections found by the remaining-failure audit", () => {
    expect(questionsForPracticeTest(9).find((question) => question.id === "9-rw-2-02")).toMatchObject({
      prompt: expect.stringContaining("Predatory animals differ widely"),
      options: { C: "provide" },
    })
    expect(questionsForPracticeTest(11).find((question) => question.id === "11-rw-2-26")?.prompt).not.toContain("Unauthorizedcopying")
    expect(questionsForPracticeTest(4).find((question) => question.id === "4-math-2-22")?.visualDescription).toContain("horizontal line y = 2")
    expect(questionsForPracticeTest(11).find((question) => question.id === "11-math-2-25")?.visualDescription).toContain("30–40 has frequency 4")
  })

  it("includes rendered PDF sources and text descriptions for every visual question", () => {
    const expectedVisuals = [16, 19, 20, 16, 21, 17, 16, 21]
    for (const [index, practiceTest] of practiceTests.entries()) {
      const questions = questionsForPracticeTest(practiceTest)
      const visuals = questions.filter((question) => question.hasVisual)
      expect(visuals, `Practice Test ${practiceTest}`).toHaveLength(expectedVisuals[index]!)
      for (const question of visuals) {
        expect(question.visualDescription?.trim().length, question.id).toBeGreaterThan(20)
        expect(question.sourcePages?.length, question.id).toBeGreaterThan(0)
        for (const { page, column } of question.sourcePages ?? []) {
          const source = `public/questions/test-${practiceTest}/page-${String(page).padStart(2, "0")}-${column}.jpg`
          expect(existsSync(source), `${question.id}: ${source}`).toBe(true)
        }
      }

      expect(questions.filter((question) => !question.hasVisual && question.visualDescription !== undefined)).toHaveLength(0)
    }
  })
})
