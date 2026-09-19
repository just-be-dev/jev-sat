import { Schema } from "effect"
import { PracticeTest as PracticeTestSchema, RunRequest, type PracticeTest } from "./domain.ts"
import { questionsForPracticeTest } from "./questions.ts"
import { randomRunForPracticeTest } from "./runs.ts"

const json = (value: unknown, status = 200): Response => Response.json(value, {
  status,
  headers: { "cache-control": "no-store" },
})

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === "GET" && url.pathname === "/api/test") {
      let practiceTest: PracticeTest
      try {
        practiceTest = Schema.decodeUnknownSync(PracticeTestSchema)(Number(url.searchParams.get("practiceTest")))
      } catch {
        return json({ error: "Invalid practice test" }, 400)
      }
      const questions = questionsForPracticeTest(practiceTest)
      return json({
        practiceTest,
        title: `SAT Practice Test ${practiceTest}`,
        totalQuestions: 120,
        multipleChoiceQuestions: questions.length,
        excludedGridIns: 14,
        model: "typesafe/jev",
        questions: questions.map(({ answer: _, ...question }) => question),
      })
    }
    if (request.method === "POST" && url.pathname === "/api/run") {
      try {
        const { practiceTest } = Schema.decodeUnknownSync(RunRequest)(await request.json())
        return json(randomRunForPracticeTest(practiceTest))
      } catch {
        return json({ error: "Invalid run request" }, 400)
      }
    }
    return json({ error: "Not found" }, 404)
  },
}
