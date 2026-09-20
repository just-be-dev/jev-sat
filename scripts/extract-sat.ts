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

interface SourcePage {
  readonly page: number
  readonly column: "left" | "right"
}

interface PositionedWord {
  readonly text: string
  readonly x: number
  readonly y: number
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

function dependsOnVisual(
  subject: SectionSpec["subject"],
  prompt: string,
  options: Readonly<Record<string, string>>,
): boolean {
  return /\b(graph|graphed|table|figure|scatterplot|dot plots?|histograms?|diagram)\b/i.test(prompt) ||
    (subject === "Math" && /\bshown\b/i.test(prompt)) ||
    Object.values(options).some((option) => /^Visual option [A-D]$/.test(option))
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function positionedWordsByPage(bbox: string): ReadonlyArray<ReadonlyArray<PositionedWord>> {
  return [...bbox.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)].map((page) =>
    [...page[1]!.matchAll(/<word xMin="([0-9.]+)" yMin="([0-9.]+)"[^>]*>([^<]+)<\/word>/g)].map((word) => ({
      text: decodeXml(word[3]!),
      x: Number(word[1]),
      y: Number(word[2]),
    }))
  )
}

function normalizeWord(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function sourceColumn(
  words: ReadonlyArray<PositionedWord>,
  number: number,
  anchors: ReadonlyArray<string>,
): SourcePage["column"] {
  const marker = words.find((word) =>
    word.text === String(number) &&
    word.y >= 90 &&
    word.y <= 730 &&
    ((word.x >= 34 && word.x <= 75) || (word.x >= 312 && word.x <= 355))
  )
  if (marker !== undefined) return marker.x >= 306 ? "right" : "left"

  for (const anchor of anchors) {
    const tokens = anchor.split(/\s+/).map(normalizeWord).filter(Boolean).slice(0, 30)
    for (const column of ["left", "right"] as const) {
      const normalizedWords = words
        .filter((word) => column === "left" ? word.x < 306 : word.x >= 306)
        .map((word) => normalizeWord(word.text))
      for (let tokenStart = 0; tokenStart <= tokens.length - 4; tokenStart++) {
        const sequence = tokens.slice(tokenStart, tokenStart + 4)
        const match = normalizedWords.findIndex((word, index) =>
          word === sequence[0] && sequence.every((token, offset) => normalizedWords[index + offset] === token)
        )
        if (match >= 0) return column
      }
    }
  }
  return "left"
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

const pdfBbox = Effect.fn("pdfBbox")(function*(file: string) {
  const child = Bun.spawn(["pdftotext", "-bbox", file, "-"], { stdout: "pipe", stderr: "ignore" })
  const [stdout, exitCode] = yield* Effect.all([
    Effect.promise(() => new Response(child.stdout).text()),
    Effect.promise(() => child.exited),
  ])
  if (exitCode !== 0) return yield* new ExtractError({ message: `Could not read PDF coordinates from ${file}` })
  return positionedWordsByPage(stdout)
})

const runCommand = Effect.fn("runCommand")(function*(command: Array<string>) {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" })
  const [stderr, exitCode] = yield* Effect.all([
    Effect.promise(() => new Response(child.stderr).text()),
    Effect.promise(() => child.exited),
  ])
  if (exitCode !== 0) {
    return yield* new ExtractError({ message: `${command[0]} failed: ${stderr.trim()}` })
  }
})

const renderSourcePage = Effect.fn("renderSourcePage")(function*(
  sourcePdf: string,
  outputDirectory: string,
  sourcePage: SourcePage,
) {
  const output = `${outputDirectory}/page-${String(sourcePage.page).padStart(2, "0")}-${sourcePage.column}`
  yield* runCommand([
    "pdftocairo",
    "-f", String(sourcePage.page),
    "-l", String(sourcePage.page),
    "-r", "110",
    "-jpeg",
    "-gray",
    "-jpegopt", "quality=72,optimize=y,progressive=y",
    "-singlefile",
    "-x", sourcePage.column === "left" ? "35" : "465",
    "-y", "120",
    "-W", "430",
    "-H", "1030",
    sourcePdf,
    output,
  ])
})

const extractTest = Effect.fn("extractTest")(function*(practiceTest: number) {
  const sourcePdf = `resources/sat-practice-test-${practiceTest}-digital.pdf`
  const answerPdf = `resources/sat-practice-test-${practiceTest}-answers-digital.pdf`
  const outputFile = `src/generated/sat-${practiceTest}.json`
  const imageDirectory = `public/questions/test-${practiceTest}`
  const [rawPdf, answers, positionedPages] = yield* Effect.all([
    pdfText(sourcePdf),
    pdfText(answerPdf),
    pdfBbox(sourcePdf),
  ])

  const pages = rawPdf.split("\f")
  const keys = answerKeys(answers)
  const questions: Array<unknown> = []
  const visualPages = new Map<string, SourcePage>()
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
      let sourcePageNumbers = [group.page + 1]
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
        if (previousPrompt.length > 20) {
          prompt = previousPrompt
          sourcePageNumbers = [group.page, group.page + 1]
        } else {
          prompt = trailingPrompt
        }
      }
      const id = `${practiceTest}-${section.subject === "Math" ? "math" : "rw"}-${section.module}-${String(number).padStart(2, "0")}`
      const hasVisual = dependsOnVisual(section.subject, prompt, options)
      const sourcePages = sourcePageNumbers.map((page): SourcePage => ({
        page,
        column: sourceColumn(positionedPages[page - 1] ?? [], number, [prompt, options.A]),
      }))
      if (Object.values(options).some((option) => /^Visual option [A-D]/.test(option))) {
        const choicesPage = sourcePages.at(-1)!
        sourcePages.push({
          page: choicesPage.page,
          column: choicesPage.column === "left" ? "right" : "left",
        })
      }
      if (hasVisual) {
        for (const sourcePage of sourcePages) {
          visualPages.set(`${sourcePage.page}-${sourcePage.column}`, sourcePage)
        }
      }
      questions.push({
        id,
        subject: section.subject,
        module: section.module,
        number,
        prompt,
        options,
        answer: key.get(number),
        hasVisual,
        ...(hasVisual ? { sourcePages } : {}),
      })
    }
  }

  yield* Effect.tryPromise({
    try: () => Bun.write(outputFile, `${JSON.stringify(questions, null, 2)}\n`),
    catch: (cause) => new ExtractError({ message: `Could not write ${outputFile}: ${String(cause)}` }),
  })
  yield* runCommand(["rm", "-rf", imageDirectory])
  yield* runCommand(["mkdir", "-p", imageDirectory])
  yield* Effect.forEach(
    [...visualPages.values()].sort((left, right) =>
      left.page - right.page || left.column.localeCompare(right.column)
    ),
    (sourcePage) => renderSourcePage(sourcePdf, imageDirectory, sourcePage),
    { concurrency: 4, discard: true },
  )
  yield* Effect.log(
    `Extracted ${questions.length} questions and ${visualPages.size} visual source crops from Practice Test ${practiceTest}`,
  )
})

const extract = Effect.forEach(practiceTests, extractTest, { concurrency: 1, discard: true })

Effect.runPromise(extract).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
