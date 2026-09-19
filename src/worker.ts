import { Schema } from "effect"
import { PracticeTest as PracticeTestSchema, RunRequest, type PracticeTest } from "./domain.ts"
import { questionsForPracticeTest } from "./questions.ts"
import { runForPracticeTest } from "./runs.ts"

const cacheControl = "public, max-age=3600, stale-while-revalidate=86400"

const json = (value: unknown, status = 200): Response => Response.json(value, {
  status,
  headers: { "cache-control": "no-store" },
})

const cachedJson = (value: unknown): Response => Response.json(value, {
  headers: { "cache-control": cacheControl },
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
      return cachedJson({
        practiceTest,
        title: `SAT Practice Test ${practiceTest}`,
        totalQuestions: 120,
        multipleChoiceQuestions: questions.length,
        excludedGridIns: 14,
        model: "typesafe/jev",
        questions: questions.map(({ answer: _, ...question }) => question),
      })
    }
    if (request.method === "GET" && url.pathname === "/api/run") {
      try {
        const { practiceTest, run } = Schema.decodeUnknownSync(RunRequest)({
          practiceTest: Number(url.searchParams.get("practiceTest")),
          run: Number(url.searchParams.get("run")),
        })
        return cachedJson(runForPracticeTest(practiceTest, run))
      } catch {
        return json({ error: "Invalid run request" }, 400)
      }
    }
    return json({ error: "Not found" }, 404)
  },
}
