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
    expect(body.practiceTest).toBe(11)
    expect(body.questions).toHaveLength(106)
    expect(body.questions.every((question) => !("answer" in question))).toBe(true)
  })

  it("returns one prerecorded complete run and rejects unknown tests", async() => {
    const response = await worker.fetch(new Request("https://example.com/api/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ practiceTest: 8 }),
    }))
    const run = await response.json() as ReadonlyArray<{ readonly _tag: string }>

    expect(response.status).toBe(200)
    expect(run[0]?._tag).toBe("started")
    expect(run.at(-1)?._tag).toBe("completed")

    const invalid = await worker.fetch(new Request("https://example.com/api/run", {
      method: "POST",
      body: JSON.stringify({ practiceTest: 12 }),
    }))
    expect(invalid.status).toBe(400)
  })
})
