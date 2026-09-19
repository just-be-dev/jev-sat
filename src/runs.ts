import { Schema } from "effect"
import test4Run1 from "../resources/runs/sat-practice-test-4-run-1.json" with { type: "json" }
import test4Run2 from "../resources/runs/sat-practice-test-4-run-2.json" with { type: "json" }
import test4Run3 from "../resources/runs/sat-practice-test-4-run-3.json" with { type: "json" }
import test4Run4 from "../resources/runs/sat-practice-test-4-run-4.json" with { type: "json" }
import test4Run5 from "../resources/runs/sat-practice-test-4-run-5.json" with { type: "json" }
import test5Run1 from "../resources/runs/sat-practice-test-5-run-1.json" with { type: "json" }
import test5Run2 from "../resources/runs/sat-practice-test-5-run-2.json" with { type: "json" }
import test5Run3 from "../resources/runs/sat-practice-test-5-run-3.json" with { type: "json" }
import test5Run4 from "../resources/runs/sat-practice-test-5-run-4.json" with { type: "json" }
import test5Run5 from "../resources/runs/sat-practice-test-5-run-5.json" with { type: "json" }
import test6Run1 from "../resources/runs/sat-practice-test-6-run-1.json" with { type: "json" }
import test6Run2 from "../resources/runs/sat-practice-test-6-run-2.json" with { type: "json" }
import test6Run3 from "../resources/runs/sat-practice-test-6-run-3.json" with { type: "json" }
import test6Run4 from "../resources/runs/sat-practice-test-6-run-4.json" with { type: "json" }
import test6Run5 from "../resources/runs/sat-practice-test-6-run-5.json" with { type: "json" }
import test7Run1 from "../resources/runs/sat-practice-test-7-run-1.json" with { type: "json" }
import test7Run2 from "../resources/runs/sat-practice-test-7-run-2.json" with { type: "json" }
import test7Run3 from "../resources/runs/sat-practice-test-7-run-3.json" with { type: "json" }
import test7Run4 from "../resources/runs/sat-practice-test-7-run-4.json" with { type: "json" }
import test7Run5 from "../resources/runs/sat-practice-test-7-run-5.json" with { type: "json" }
import test8Run1 from "../resources/runs/sat-practice-test-8-run-1.json" with { type: "json" }
import test8Run2 from "../resources/runs/sat-practice-test-8-run-2.json" with { type: "json" }
import test8Run3 from "../resources/runs/sat-practice-test-8-run-3.json" with { type: "json" }
import test8Run4 from "../resources/runs/sat-practice-test-8-run-4.json" with { type: "json" }
import test8Run5 from "../resources/runs/sat-practice-test-8-run-5.json" with { type: "json" }
import test9Run1 from "../resources/runs/sat-practice-test-9-run-1.json" with { type: "json" }
import test9Run2 from "../resources/runs/sat-practice-test-9-run-2.json" with { type: "json" }
import test9Run3 from "../resources/runs/sat-practice-test-9-run-3.json" with { type: "json" }
import test9Run4 from "../resources/runs/sat-practice-test-9-run-4.json" with { type: "json" }
import test9Run5 from "../resources/runs/sat-practice-test-9-run-5.json" with { type: "json" }
import test10Run1 from "../resources/runs/sat-practice-test-10-run-1.json" with { type: "json" }
import test10Run2 from "../resources/runs/sat-practice-test-10-run-2.json" with { type: "json" }
import test10Run3 from "../resources/runs/sat-practice-test-10-run-3.json" with { type: "json" }
import test10Run4 from "../resources/runs/sat-practice-test-10-run-4.json" with { type: "json" }
import test10Run5 from "../resources/runs/sat-practice-test-10-run-5.json" with { type: "json" }
import test11Run1 from "../resources/runs/sat-practice-test-11-run-1.json" with { type: "json" }
import test11Run2 from "../resources/runs/sat-practice-test-11-run-2.json" with { type: "json" }
import test11Run3 from "../resources/runs/sat-practice-test-11-run-3.json" with { type: "json" }
import test11Run4 from "../resources/runs/sat-practice-test-11-run-4.json" with { type: "json" }
import test11Run5 from "../resources/runs/sat-practice-test-11-run-5.json" with { type: "json" }
import { RunEvent, type PracticeTest, type RunEvent as RunEventType } from "./domain.ts"

const decodeRun = Schema.decodeUnknownSync(Schema.Array(RunEvent))

const runsByPracticeTest: Readonly<Record<PracticeTest, ReadonlyArray<ReadonlyArray<RunEventType>>>> = {
  4: [test4Run1, test4Run2, test4Run3, test4Run4, test4Run5].map((run) => decodeRun(run)),
  5: [test5Run1, test5Run2, test5Run3, test5Run4, test5Run5].map((run) => decodeRun(run)),
  6: [test6Run1, test6Run2, test6Run3, test6Run4, test6Run5].map((run) => decodeRun(run)),
  7: [test7Run1, test7Run2, test7Run3, test7Run4, test7Run5].map((run) => decodeRun(run)),
  8: [test8Run1, test8Run2, test8Run3, test8Run4, test8Run5].map((run) => decodeRun(run)),
  9: [test9Run1, test9Run2, test9Run3, test9Run4, test9Run5].map((run) => decodeRun(run)),
  10: [test10Run1, test10Run2, test10Run3, test10Run4, test10Run5].map((run) => decodeRun(run)),
  11: [test11Run1, test11Run2, test11Run3, test11Run4, test11Run5].map((run) => decodeRun(run)),
}

export const runsForPracticeTest = (practiceTest: PracticeTest): ReadonlyArray<ReadonlyArray<RunEventType>> =>
  runsByPracticeTest[practiceTest]

export const randomRunForPracticeTest = (practiceTest: PracticeTest): ReadonlyArray<RunEventType> => {
  const runs = runsForPracticeTest(practiceTest)
  return runs[Math.floor(Math.random() * runs.length)]!
}
