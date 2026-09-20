const elements = {
  answered: document.querySelector("#answered"),
  choices: document.querySelector("#choices"),
  confidence: document.querySelector("#confidence"),
  connection: document.querySelector("#connection"),
  decisionMeta: document.querySelector("#decision-meta"),
  progressBar: document.querySelector("#progress-bar"),
  progressDetail: document.querySelector("#progress-detail"),
  prompt: document.querySelector("#prompt"),
  questionContent: document.querySelector("#question-content"),
  questionEmpty: document.querySelector("#question-empty"),
  questionStatus: document.querySelector("#question-status"),
  questionTitle: document.querySelector("#question-title"),
  queue: document.querySelector("#queue"),
  run: document.querySelector("#run"),
  score: document.querySelector("#score"),
  scoreDetail: document.querySelector("#score-detail"),
  sourcePages: document.querySelector("#source-pages"),
  practiceTest: document.querySelector("#practice-test"),
  testLabel: document.querySelector("#test-label"),
  toast: document.querySelector("#toast"),
  tokens: document.querySelector("#tokens"),
  total: document.querySelector("#total"),
  visualWarning: document.querySelector("#visual-warning"),
}

const labels = ["A", "B", "C", "D"]
let test = null
let selected = []
let questionById = new Map()
let queueById = new Map()
let answerById = new Map()
let thinkingIds = new Set()
let focusedQuestionId = null
let controller = null
let stats = freshStats()

function freshStats() {
  return { answered: 0, correct: 0, confidence: 0, inputTokens: 0, outputTokens: 0, total: 0 }
}

function setConnection(text, state = "") {
  elements.connection.className = `connection ${state}`.trim()
  elements.connection.lastElementChild.textContent = text
}

function questionName(question) {
  const subject = question.subject === "Reading and Writing" ? "Reading & Writing" : "Math"
  return `${subject} · Module ${question.module} · Q${question.number}`
}

function renderQueue() {
  elements.queue.replaceChildren()
  queueById = new Map()
  selected.forEach((question, index) => {
    const row = document.createElement("button")
    row.type = "button"
    row.className = "queue-item"
    row.dataset.id = question.id
    row.setAttribute("aria-pressed", "false")
    row.addEventListener("click", () => focusQuestion(question.id))

    const count = document.createElement("span")
    count.className = "queue-index"
    count.textContent = String(index + 1).padStart(2, "0")

    const copy = document.createElement("span")
    copy.className = "queue-copy"
    const title = document.createElement("span")
    title.className = "queue-title"
    title.textContent = `Question ${question.number}`
    const subtitle = document.createElement("span")
    subtitle.className = "queue-subtitle"
    subtitle.textContent = `${question.subject === "Math" ? "Math" : "Reading & Writing"} · M${question.module}`
    copy.append(title, subtitle)

    const result = document.createElement("span")
    result.className = "queue-result"
    result.textContent = "Queued"
    row.append(count, copy, result)
    elements.queue.append(row)
    queueById.set(question.id, row)
  })
}

function focusQuestion(id) {
  focusedQuestionId = id
  for (const [questionId, row] of queueById) {
    const focused = questionId === id
    row.classList.toggle("active", focused)
    row.setAttribute("aria-pressed", String(focused))
  }

  const question = questionById.get(id)
  if (question) renderQuestion(question, answerById.get(id), thinkingIds.has(id))
}

function renderQuestion(question, event, isThinking) {
  elements.questionEmpty.hidden = true
  elements.questionContent.hidden = false
  elements.questionTitle.textContent = questionName(question)
  elements.prompt.textContent = question.prompt
  elements.visualWarning.hidden = !question.hasVisual
  renderSourcePages(question)
  elements.choices.replaceChildren()

  const maxProbability = event ? Math.max(...Object.values(event.probabilities), 0.01) : 1
  for (const label of labels) {
    const choice = document.createElement("div")
    const probability = event?.probabilities[label] ?? 0
    choice.className = "choice"
    if (event?.label === label) choice.classList.add("selected")
    if (event?.expected === label) choice.classList.add("expected")
    if (event?.correct && event.label === label) choice.classList.add("correct")

    const fill = document.createElement("span")
    fill.className = "choice-fill"
    fill.style.width = event ? `${(probability / maxProbability) * 100}%` : "0"
    const badge = document.createElement("span")
    badge.className = "choice-label"
    badge.textContent = label
    const text = document.createElement("span")
    text.className = "choice-text"
    text.textContent = question.options[label]
    const percent = document.createElement("span")
    percent.className = "choice-probability"
    percent.textContent = event ? `${Math.round(probability * 100)}%` : "—"
    choice.append(fill, badge, text, percent)
    elements.choices.append(choice)
  }

  if (!event) {
    elements.questionStatus.className = `question-status${isThinking ? " thinking" : ""}`
    elements.questionStatus.textContent = isThinking ? "Evaluating" : "Queued"
    elements.decisionMeta.textContent = isThinking
      ? "Jev is comparing four defined criteria…"
      : "Waiting for Jev to evaluate this question…"
    return
  }

  elements.questionStatus.className = `question-status ${event.correct ? "correct" : "wrong"}`
  elements.questionStatus.textContent = event.correct ? "Correct" : "Incorrect"
  elements.decisionMeta.replaceChildren(
    meta(`Jev chose ${event.label}`),
    meta(`Answer ${event.expected}`),
    meta(`${Math.round(event.confidence * 100)}% confidence`),
    meta(`${(event.batchDurationMs / 1000).toFixed(1)}s batch`),
  )
}

function renderSourcePages(question) {
  const pages = question.sourcePages ?? []
  elements.sourcePages.hidden = pages.length === 0
  elements.sourcePages.replaceChildren()
  for (const { page, column } of pages) {
    const source = `/questions/test-${test.practiceTest}/page-${String(page).padStart(2, "0")}-${column}.jpg`
    const link = document.createElement("a")
    link.className = "source-page"
    link.href = source
    link.target = "_blank"
    link.rel = "noreferrer"

    const image = document.createElement("img")
    image.src = source
    image.alt = `Official SAT Practice Test ${test.practiceTest}, PDF page ${page} ${column} column`
    image.loading = "lazy"
    image.decoding = "async"

    const label = document.createElement("span")
    label.textContent = `Official PDF page ${page} · Open to zoom`
    link.append(image, label)
    elements.sourcePages.append(link)
  }
}

function meta(text) {
  const span = document.createElement("span")
  span.textContent = text
  return span
}

function updateStats() {
  const progress = stats.total ? stats.answered / stats.total : 0
  elements.answered.textContent = String(stats.answered)
  elements.total.textContent = ` / ${stats.total || selected.length || 106}`
  elements.progressDetail.textContent = `${Math.round(progress * 100)}% complete`
  elements.progressBar.style.width = `${progress * 100}%`
  elements.tokens.textContent = (stats.inputTokens + stats.outputTokens).toLocaleString()
  if (stats.answered > 0) {
    elements.score.textContent = `${Math.round((stats.correct / stats.answered) * 100)}%`
    elements.scoreDetail.textContent = `${stats.correct} correct · ${stats.answered - stats.correct} missed`
    elements.confidence.textContent = `${Math.round((stats.confidence / stats.answered) * 100)}%`
  }
}

function updateQueueThinking(ids) {
  thinkingIds = new Set(ids)
  for (const row of queueById.values()) {
    row.classList.remove("thinking")
  }
  ids.forEach((id) => {
    const row = queueById.get(id)
    if (row) {
      row.classList.add("thinking")
      row.querySelector(".queue-result").textContent = "Thinking"
    }
  })
  if (focusedQuestionId) focusQuestion(focusedQuestionId)
}

function keepQueueRowVisible(row) {
  const queueBounds = elements.queue.getBoundingClientRect()
  const rowBounds = row.getBoundingClientRect()
  if (rowBounds.top < queueBounds.top) {
    elements.queue.scrollTop += rowBounds.top - queueBounds.top
  } else if (rowBounds.bottom > queueBounds.bottom) {
    elements.queue.scrollTop += rowBounds.bottom - queueBounds.bottom
  }
}

function handleEvent(event) {
  if (event._tag === "started") {
    stats.total = event.total
    updateStats()
    return
  }
  if (event._tag === "thinking") {
    updateQueueThinking(event.ids)
    return
  }
  if (event._tag === "answer") {
    answerById.set(event.id, event)
    thinkingIds.delete(event.id)
    stats.answered++
    if (event.correct) stats.correct++
    stats.confidence += event.confidence
    stats.inputTokens += event.inputTokens ?? 0
    stats.outputTokens += event.outputTokens ?? 0
    updateStats()

    const row = queueById.get(event.id)
    if (row) {
      row.classList.remove("thinking")
      row.classList.add(event.correct ? "correct" : "wrong")
      row.querySelector(".queue-result").textContent = event.correct ? `${event.label} ✓` : `${event.label} · ${event.expected}`
      keepQueueRowVisible(row)
    }
    if (focusedQuestionId === event.id) focusQuestion(event.id)
    return
  }
  if (event._tag === "completed") {
    stats.inputTokens = event.inputTokens
    stats.outputTokens = event.outputTokens
    updateStats()
    setConnection("Complete", "done")
    stopRunning("See another run")
    return
  }
  if (event._tag === "failed") {
    showError(event.message)
    stopRunning("Try again")
  }
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timeout)
      reject(new DOMException("Replay stopped", "AbortError"))
    }
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, milliseconds)
    signal.addEventListener("abort", abort, { once: true })
  })
}

async function replay(events, signal) {
  for (const event of events) {
    if (event._tag === "thinking") await delay(260, signal)
    if (event._tag === "answer") await delay(65, signal)
    handleEvent(event)
  }
}

function stopRunning(label) {
  controller = null
  elements.run.classList.remove("running")
  elements.run.querySelector(".button-label").textContent = label
  elements.run.querySelector(".button-arrow").textContent = "↗"
  elements.practiceTest.disabled = false
}

function showError(message) {
  setConnection("Error")
  elements.toast.textContent = message
  elements.toast.hidden = false
  window.setTimeout(() => { elements.toast.hidden = true }, 7000)
}

async function startRun() {
  if (controller) {
    controller.abort()
    stopRunning("See a run")
    setConnection("Stopped")
    return
  }

  selected = test.questions
  questionById = new Map(selected.map((question) => [question.id, question]))
  answerById = new Map()
  thinkingIds = new Set()
  focusedQuestionId = null
  stats = freshStats()
  stats.total = selected.length
  renderQueue()
  updateStats()
  elements.score.textContent = "—"
  elements.scoreDetail.textContent = "Run in progress"
  elements.confidence.textContent = "—"
  elements.tokens.textContent = "0"
  elements.questionTitle.textContent = "Select a question"
  elements.questionStatus.className = "question-status"
  elements.questionStatus.textContent = "Queue"
  elements.questionContent.hidden = true
  elements.questionEmpty.hidden = false
  elements.questionEmpty.querySelector("p").textContent = "Choose any question in the replay queue to inspect Jev’s decision."

  controller = new AbortController()
  elements.run.classList.add("running")
  elements.run.querySelector(".button-label").textContent = "Stop replay"
  elements.run.querySelector(".button-arrow").textContent = "×"
  elements.practiceTest.disabled = true
  setConnection("Replaying", "live")

  try {
    const practiceTest = Number(elements.practiceTest.value)
    const run = Math.floor(Math.random() * 5) + 1
    const response = await fetch(`/api/run?practiceTest=${practiceTest}&run=${run}`, {
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Run request failed (${response.status})`)
    await replay(await response.json(), controller.signal)
  } catch (error) {
    if (error.name !== "AbortError") showError(error.message || String(error))
    if (controller) stopRunning("Try again")
  }
}

async function loadTest() {
  elements.run.disabled = true
  try {
    const practiceTest = Number(elements.practiceTest.value)
    const response = await fetch(`/api/test?practiceTest=${practiceTest}`)
    if (!response.ok) throw new Error(`Could not load test (${response.status})`)
    test = await response.json()
    selected = []
    questionById = new Map()
    queueById = new Map()
    answerById = new Map()
    thinkingIds = new Set()
    focusedQuestionId = null
    stats = freshStats()
    elements.answered.textContent = "0"
    elements.total.textContent = ` / ${test.multipleChoiceQuestions}`
    elements.progressDetail.textContent = "0% complete"
    elements.progressBar.style.width = "0"
    elements.score.textContent = "—"
    elements.scoreDetail.textContent = "Not started"
    elements.confidence.textContent = "—"
    elements.tokens.textContent = "0"
    elements.questionTitle.textContent = "Waiting for a run"
    elements.questionStatus.className = "question-status"
    elements.questionStatus.textContent = "Idle"
    elements.questionContent.hidden = true
    elements.questionEmpty.hidden = false
    elements.questionEmpty.querySelector("p").textContent = "Start a replay, then select a question from the queue to inspect Jev’s decision."
    elements.queue.innerHTML = '<p class="queue-empty">Questions will appear here when the run begins.</p>'
    elements.testLabel.textContent = `Official SAT Practice Test ${test.practiceTest}`
    elements.run.querySelector(".button-label").textContent = "See a run"
    elements.run.querySelector(".button-arrow").textContent = "↗"
    setConnection("Ready")
    elements.run.disabled = false
  } catch (error) {
    showError(error.message || String(error))
  }
}

async function initialize() {
  elements.practiceTest.addEventListener("change", loadTest)
  elements.run.addEventListener("click", startRun)
  await loadTest()
}

initialize()
