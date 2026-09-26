import { describe, expect, it } from "vitest"
import { adjacentResultId, carouselFor, firstReviewResultId } from "../public/result-carousel.js"

const questions = ["one", "two", "three", "four", "five"].map((id) => ({ id }))
const answers = new Map([
  ["one", { correct: true }],
  ["two", { correct: false }],
  ["three", { correct: true }],
  ["four", { correct: false }],
  ["five", { correct: true }],
])

describe("result carousel", () => {
  it("starts review on the first failed result", () => {
    expect(firstReviewResultId(questions, answers)).toBe("two")
  })

  it("skips successes and wraps while a failed result is selected", () => {
    expect(carouselFor(questions, answers, "two")).toEqual({
      correct: false,
      ids: ["two", "four"],
      index: 0,
    })
    expect(adjacentResultId(questions, answers, "two", -1)).toBe("four")
    expect(adjacentResultId(questions, answers, "four", 1)).toBe("two")
  })

  it("inverts to successes when a successful result is selected", () => {
    expect(carouselFor(questions, answers, "three")).toEqual({
      correct: true,
      ids: ["one", "three", "five"],
      index: 1,
    })
    expect(adjacentResultId(questions, answers, "three", 1)).toBe("five")
  })

  it("falls back to a success when there are no failures", () => {
    const successfulAnswers = new Map(questions.map(({ id }) => [id, { correct: true }]))
    expect(firstReviewResultId(questions, successfulAnswers)).toBe("one")
  })
})
