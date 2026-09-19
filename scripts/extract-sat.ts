import { Effect, Schema } from "effect"

const sourcePdf = "resources/sat-practice-test-4-digital.pdf"
const answerMarkdown = "resources/sat-practice-test-4-answers-digital.md"
const outputFile = "src/generated/sat.json"

const Label = Schema.Literals(["A", "B", "C", "D"])

class ExtractError extends Schema.TaggedError<ExtractError>()("ExtractError", {
  message: Schema.String,
}) {}

interface SectionSpec {
  readonly subject: "Reading and Writing" | "Math"
  readonly module: 1 | 2
  readonly pageIndexes: ReadonlyArray<number>
  readonly questionCount: number
}

const sections: ReadonlyArray<SectionSpec> = [
  { subject: "Reading and Writing", module: 1, pageIndexes: range(3, 17), questionCount: 33 },
  { subject: "Reading and Writing", module: 2, pageIndexes: range(17, 30), questionCount: 33 },
  { subject: "Math", module: 1, pageIndexes: range(33, 39), questionCount: 27 },
  { subject: "Math", module: 2, pageIndexes: range(41, 48), questionCount: 27 },
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

function answerKeys(markdown: string): ReadonlyArray<ReadonlyMap<number, typeof Label.Type>> {
  const matches = [...markdown.matchAll(/^#### QUESTION (\d+)\s*$/gm)]
  if (matches.length !== 120) {
    throw new ExtractError({ message: `Expected 120 answer explanations, found ${matches.length}` })
  }

  const keys: Array<ReadonlyMap<number, typeof Label.Type>> = []
  let offset = 0
  for (const section of sections) {
    const entries = new Map<number, typeof Label.Type>()
    for (let index = 0; index < section.questionCount; index++) {
      const match = matches[offset + index]!
      const start = match.index + match[0].length
      const end = matches[offset + index + 1]?.index ?? markdown.length
      const block = markdown.slice(start, end)
      const answer = block.match(/\*\*Choice ([A-D])\*\* is (?:the best answer|correct)/)?.[1]
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

function choiceGroups(pages: ReadonlyArray<string>, pageIndexes: ReadonlyArray<number>): ReadonlyArray<ChoiceGroup> {
  const groups: Array<ChoiceGroup> = []
  for (const page of pageIndexes) {
    const lines = pages[page]!.split("\n").map((line) => line.trim()).filter(Boolean)
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

const extract = Effect.fn("extractSat")(function*() {
  const answers = yield* Effect.tryPromise({
    try: () => Bun.file(answerMarkdown).text(),
    catch: (cause) => new ExtractError({ message: `Could not read answer explanations: ${String(cause)}` }),
  })

  const process = Bun.spawn(["pdftotext", "-raw", sourcePdf, "-"], { stdout: "pipe", stderr: "pipe" })
  const [rawPdf, stderr, exitCode] = yield* Effect.all([
    Effect.promise(() => new Response(process.stdout).text()),
    Effect.promise(() => new Response(process.stderr).text()),
    Effect.promise(() => process.exited),
  ])
  if (exitCode !== 0) {
    return yield* new ExtractError({ message: `pdftotext failed: ${stderr.trim()}` })
  }

  const pages = rawPdf.split("\f")
  const keys = answerKeys(answers)
  const questions: Array<unknown> = []

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
    const section = sections[sectionIndex]!
    const key = keys[sectionIndex]!
    const multipleChoiceNumbers = [...key.keys()]
    const groups = choiceGroups(pages, section.pageIndexes)
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
      if (marker < 0) {
        return yield* new ExtractError({
          message: `${section.subject} module ${section.module}, question ${number}: question marker not found on PDF page ${group.page + 1}`,
        })
      }

      const nextQuestion = firstIndex(group.lines, String(number + 1), d + 1, group.lines.length)
      const footer = group.lines.findIndex((line, lineIndex) =>
        lineIndex > d && (/^Unauthorized copying/.test(line) || line === "STOP")
      )
      const end = [nextQuestion, footer, group.lines.length]
        .filter((position) => position >= 0)
        .reduce((smallest, position) => Math.min(smallest, position), group.lines.length)

      const options = {
        A: optionText(group.lines, a, b),
        B: optionText(group.lines, b, c),
        C: optionText(group.lines, c, d),
        D: optionText(group.lines, d, end),
      }
      const prefix = group.previousChoiceEnd === 0 ? pagePrefix(group.lines, marker, section.module) : []
      const prompt = cleanText([...prefix, ...group.lines.slice(marker + 1, a)])
      const id = `${section.subject === "Math" ? "math" : "rw"}-${section.module}-${String(number).padStart(2, "0")}`
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
  yield* Effect.log(`Extracted ${questions.length} multiple-choice questions to ${outputFile}`)
})

Effect.runPromise(extract()).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
