import { describe, expect, it } from "@effect/vitest"
import worker from "../src/worker.ts"

describe("SAT replay API", () => {
  it("serves the selected practice test without answer keys", async() => {
    const response = await worker.fetch(new Request("https://example.com/api/test?practiceTest=11"))
    const body = await response.json() as {
      readonly practiceTest: number
      readonly questions: ReadonlyArray<Record<string, unknown>>
    }

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400")
    expect(body.practiceTest).toBe(11)
    expect(body.questions).toHaveLength(106)
    expect(body.questions.every((question) => !("answer" in question))).toBe(true)
  })

  it("returns one stable, cacheable prerecorded run and rejects unknown runs", async() => {
    const response = await worker.fetch(new Request("https://example.com/api/run?practiceTest=8&run=4"))
    const events = await response.json() as ReadonlyArray<{ readonly _tag: string; readonly correct?: number }>

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600, stale-while-revalidate=86400")
    expect(events[0]?._tag).toBe("started")
    expect(events.at(-1)).toMatchObject({ _tag: "completed", correct: 98 })

    const invalid = await worker.fetch(new Request("https://example.com/api/run?practiceTest=8&run=6"))
    expect(invalid.status).toBe(400)
    expect(invalid.headers.get("cache-control")).toBe("no-store")
  })
})
