import { Effect, Schema } from "effect"

const practiceTests = [4, 5, 6, 7, 8, 9, 10, 11] as const

const Label = Schema.Literals(["A", "B", "C", "D"])

class ExtractError extends Schema.TaggedError<ExtractError>()("ExtractError", {
  message: Schema.String,
}) {}

interface SectionSpec {
  readonly subject: "Reading and Writing" | "Math"
  readonly module: 1 | 2
  readonly questionCount: number
}

const sectionSpecs: ReadonlyArray<SectionSpec> = [
  { subject: "Reading and Writing", module: 1, questionCount: 33 },
  { subject: "Reading and Writing", module: 2, questionCount: 33 },
  { subject: "Math", module: 1, questionCount: 27 },
  { subject: "Math", module: 2, questionCount: 27 },
]

function range(start: number, end: number): ReadonlyArray<number> {
  return Array.from({ length: end - start }, (_, index) => start + index)
}

function cleanText(lines: ReadonlyArray<string>): string {
  return lines
    .filter((line) =>
      line.length > 0 &&
      !/^\.{8,}$/.test(line) &&
      !/^-+~?$/.test(line) &&
      !/^Unauthorized copying/.test(line) &&
      line !== "CONTINUE"
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

function answerKeys(answerText: string): ReadonlyArray<ReadonlyMap<number, typeof Label.Type>> {
  const matches = [...answerText.matchAll(/^QUESTION\s+(\d+)\s*$/gm)]
  if (matches.length !== 120) {
    throw new ExtractError({ message: `Expected 120 answer explanations, found ${matches.length}` })
  }

  const keys: Array<ReadonlyMap<number, typeof Label.Type>> = []
  let offset = 0
  for (const section of sectionSpecs) {
    const entries = new Map<number, typeof Label.Type>()
    for (let index = 0; index < section.questionCount; index++) {
      const match = matches[offset + index]!
      const start = match.index + match[0].length
      const end = matches[offset + index + 1]?.index ?? answerText.length
      const block = answerText.slice(start, end)
      const answer = block.match(/Choice\s*([A-D])\s*is\s*(?:the\s*best\s*answer|correct)/)?.[1]
      if (answer !== undefined) {
        entries.set(Number(match[1]), Schema.decodeUnknownSync(Label)(answer))
      }
    }
    keys.push(entries)
    offset += section.questionCount
  }
  return keys
}

interface ChoiceGroup {
  readonly page: number
  readonly lines: ReadonlyArray<string>
  readonly indexes: readonly [number, number, number, number]
  readonly previousChoiceEnd: number
}

function normalizeVisualChoices(lines: ReadonlyArray<string>): ReadonlyArray<string> {
  const normalized = [...lines]
  for (let a = 0; a < normalized.length; a++) {
    if (!/^A\)\s+B\)\s*$/.test(normalized[a]!)) continue
    const c = normalized.findIndex((line, index) => index > a && /^C\)\s+D\)\s*$/.test(line))
    if (c < 0) continue
    normalized.splice(
      a,
      c - a + 1,
      "A) Visual option A",
      "B) Visual option B",
      "C) Visual option C",
      "D) Visual option D",
      ...normalized.slice(a + 1, c),
    )
  }
  return normalized
}

function choiceGroups(pages: ReadonlyArray<string>, pageIndexes: ReadonlyArray<number>): ReadonlyArray<ChoiceGroup> {
  const groups: Array<ChoiceGroup> = []
  for (const page of pageIndexes) {
    const lines = normalizeVisualChoices(pages[page]!.split("\n").map((line) => line.trim()).filter(Boolean))
    let cursor = 0
    let previousChoiceEnd = 0
    while (cursor < lines.length) {
      const a = lines.findIndex((line, index) => index >= cursor && line.startsWith("A)"))
      if (a < 0) break
      const b = lines.findIndex((line, index) => index > a && line.startsWith("B)"))
      const c = lines.findIndex((line, index) => index > b && line.startsWith("C)"))
      const d = lines.findIndex((line, index) => index > c && line.startsWith("D)"))
      if (b < 0 || c < 0 || d < 0) {
        throw new ExtractError({ message: `Incomplete choice group on PDF page ${page + 1}` })
      }
      groups.push({ page, lines, indexes: [a, b, c, d], previousChoiceEnd })
      previousChoiceEnd = d + 1
      cursor = d + 1
    }
  }
  return groups
}

function firstIndex(lines: ReadonlyArray<string>, value: string, start: number, end: number): number {
  const decoratedMarker = new RegExp(`^[\\s\\-~]*${value}$`)
  for (let index = start; index < end; index++) {
    if (decoratedMarker.test(lines[index]!)) return index
  }
  return -1
}

function lastIndex(lines: ReadonlyArray<string>, value: string, start: number, end: number): number {
  const decoratedMarker = new RegExp(`^[\\s\\-~]*${value}$`)
  for (let index = end - 1; index >= start; index--) {
    if (decoratedMarker.test(lines[index]!)) return index
  }
  return -1
}

function pagePrefix(lines: ReadonlyArray<string>, marker: number, module: 1 | 2): ReadonlyArray<string> {
  const prefix = lines.slice(0, marker)
  if (prefix.includes("DIRECTIONS")) return []
  return prefix.filter((line, index) =>
    line !== "Module" &&
    !(index <= 2 && line === String(module)) &&
    !/^\.{8,}$/.test(line) &&
    !/^[\s\-~]+$/.test(line)
  )
}

function optionText(lines: ReadonlyArray<string>, start: number, end: number): string {
  const first = lines[start]!.slice(2).trim()
  return cleanText([first, ...lines.slice(start + 1, end)])
}

const pdfText = Effect.fn("pdfText")(function*(file: string) {
  const child = Bun.spawn(["pdftotext", "-raw", file, "-"], { stdout: "pipe", stderr: "pipe" })
  const [stdout, stderr, exitCode] = yield* Effect.all([
    Effect.promise(() => new Response(child.stdout).text()),
    Effect.promise(() => new Response(child.stderr).text()),
    Effect.promise(() => child.exited),
  ])
  if (exitCode !== 0) return yield* new ExtractError({ message: `pdftotext failed for ${file}: ${stderr.trim()}` })
  return stdout
})

const extractTest = Effect.fn("extractTest")(function*(practiceTest: number) {
  const sourcePdf = `resources/sat-practice-test-${practiceTest}-digital.pdf`
  const answerPdf = `resources/sat-practice-test-${practiceTest}-answers-digital.pdf`
  const outputFile = `src/generated/sat-${practiceTest}.json`
  const [rawPdf, answers] = yield* Effect.all([pdfText(sourcePdf), pdfText(answerPdf)])

  const pages = rawPdf.split("\f")
  const keys = answerKeys(answers)
  const questions: Array<unknown> = []
  const starts = [
    ...pages.flatMap((page, index) => page.includes("33 QUESTIONS") ? [index] : []),
    ...pages.flatMap((page, index) => page.includes("27 QUESTIONS") ? [index] : []),
  ]
  const stops = pages.flatMap((page, index) => /\bSTOP\b/.test(page) ? [index] : [])
  if (starts.length !== 4 || stops.length !== 4) {
    return yield* new ExtractError({
      message: `Practice Test ${practiceTest}: expected four section boundaries, found ${starts.length} starts and ${stops.length} stops`,
    })
  }

  for (let sectionIndex = 0; sectionIndex < sectionSpecs.length; sectionIndex++) {
    const section = sectionSpecs[sectionIndex]!
    const key = keys[sectionIndex]!
    const multipleChoiceNumbers = [...key.keys()]
    const groups = choiceGroups(pages, range(starts[sectionIndex]!, stops[sectionIndex]! + 1))
    if (groups.length !== multipleChoiceNumbers.length) {
      return yield* new ExtractError({
        message: `${section.subject} module ${section.module}: expected ${multipleChoiceNumbers.length} choice groups, found ${groups.length}`,
      })
    }

    for (let index = 0; index < groups.length; index++) {
      const group = groups[index]!
      const number = multipleChoiceNumbers[index]!
      const [a, b, c, d] = group.indexes
      const marker = lastIndex(group.lines, String(number), group.previousChoiceEnd, a)
      const promptStart = marker < 0 ? group.previousChoiceEnd : marker + 1

      const nextQuestion = firstIndex(group.lines, String(number + 1), d + 1, group.lines.length)
      const footer = group.lines.findIndex((line, lineIndex) =>
        lineIndex > d && (/^Unauthorized copying/.test(line) || line === "STOP")
      )
      const end = [nextQuestion, footer, group.lines.length]
        .filter((position) => position >= 0)
        .reduce((smallest, position) => Math.min(smallest, position), group.lines.length)

      const optionD = optionText(group.lines, d, end)
      const continuation = optionD.length === 0 && footer >= 0
        ? group.lines.findIndex((line, lineIndex) => lineIndex > footer && line.startsWith("CONTINUE"))
        : -1
      const options = {
        A: optionText(group.lines, a, b),
        B: optionText(group.lines, b, c),
        C: optionText(group.lines, c, d),
        D: optionD.length > 0
          ? optionD
          : cleanText(group.lines.slice(footer + 1, continuation < 0 ? group.lines.length : continuation)),
      }
      const prefix = group.previousChoiceEnd === 0 ? pagePrefix(group.lines, Math.max(marker, 0), section.module) : []
      let prompt = cleanText([...prefix, ...group.lines.slice(promptStart, a)])
      if (prompt.length <= 20) {
        const previousLines = pages[group.page - 1]?.split("\n").map((line) => line.trim()).filter(Boolean) ?? []
        const previousMarker = lastIndex(previousLines, String(number), 0, previousLines.length)
        const previousFooter = previousLines.findIndex((line, lineIndex) =>
          lineIndex > previousMarker && /^Unauthorized copying/.test(line)
        )
        const previousPrompt = previousMarker < 0
          ? ""
          : cleanText(previousLines.slice(previousMarker + 1, previousFooter < 0 ? previousLines.length : previousFooter))
        const trailingPrompt = footer < 0 ? "" : cleanText(group.lines.slice(footer + 1))
        prompt = previousPrompt.length > 20 ? previousPrompt : trailingPrompt
      }
      const id = `${practiceTest}-${section.subject === "Math" ? "math" : "rw"}-${section.module}-${String(number).padStart(2, "0")}`
      questions.push({
        id,
        subject: section.subject,
        module: section.module,
        number,
        prompt,
        options,
        answer: key.get(number),
        hasVisual: /\b(graph|table|figure|scatterplot|dot plot)\b/i.test(prompt),
      })
    }
  }

  yield* Effect.tryPromise({
    try: () => Bun.write(outputFile, `${JSON.stringify(questions, null, 2)}\n`),
    catch: (cause) => new ExtractError({ message: `Could not write ${outputFile}: ${String(cause)}` }),
  })
  yield* Effect.log(`Extracted ${questions.length} questions from Practice Test ${practiceTest} to ${outputFile}`)
})

const extract = Effect.forEach(practiceTests, extractTest, { concurrency: 1, discard: true })

Effect.runPromise(extract).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
