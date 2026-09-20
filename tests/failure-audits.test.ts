import { describe, expect, it } from "@effect/vitest"
import audit4 from "../src/generated/failure-audits/sat-4.json" with { type: "json" }
import audit5 from "../src/generated/failure-audits/sat-5.json" with { type: "json" }
import audit6 from "../src/generated/failure-audits/sat-6.json" with { type: "json" }
import audit7 from "../src/generated/failure-audits/sat-7.json" with { type: "json" }
import audit8 from "../src/generated/failure-audits/sat-8.json" with { type: "json" }
import audit9 from "../src/generated/failure-audits/sat-9.json" with { type: "json" }
import audit10 from "../src/generated/failure-audits/sat-10.json" with { type: "json" }
import audit11 from "../src/generated/failure-audits/sat-11.json" with { type: "json" }

const audits: ReadonlyArray<Readonly<Record<string, {
  readonly failedRuns: number
  readonly classification: string
  readonly pdfPages: ReadonlyArray<number>
  readonly finding: string
}>>> = [audit4, audit5, audit6, audit7, audit8, audit9, audit10, audit11]

describe("remaining failure audit", () => {
  it("classifies every observed failure with PDF evidence", () => {
    const entries = audits.flatMap(Object.entries)
    expect(entries).toHaveLength(99)
    expect(entries.filter(([, audit]) => audit.classification === "legitimate")).toHaveLength(81)
    expect(entries.filter(([, audit]) => audit.classification === "malformed-text")).toHaveLength(14)
    expect(entries.filter(([, audit]) => audit.classification === "missing-visual")).toHaveLength(4)
    expect(entries.filter(([, audit]) => audit.classification === "ambiguous-source")).toHaveLength(0)

    for (const [id, audit] of entries) {
      expect(audit.failedRuns, id).toBeGreaterThanOrEqual(1)
      expect(audit.failedRuns, id).toBeLessThanOrEqual(5)
      expect(audit.pdfPages.length, id).toBeGreaterThan(0)
      expect(audit.finding.length, id).toBeGreaterThan(40)
    }
  })
})
