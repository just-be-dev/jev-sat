export function resultIds(questions, answers, correct) {
  return questions
    .filter((question) => answers.get(question.id)?.correct === correct)
    .map((question) => question.id)
}

export function firstReviewResultId(questions, answers) {
  return resultIds(questions, answers, false)[0]
    ?? resultIds(questions, answers, true)[0]
    ?? null
}

export function carouselFor(questions, answers, focusedId) {
  const focusedAnswer = answers.get(focusedId)
  if (!focusedAnswer) return null

  const ids = resultIds(questions, answers, focusedAnswer.correct)
  const index = ids.indexOf(focusedId)
  return index === -1 ? null : { correct: focusedAnswer.correct, ids, index }
}

export function adjacentResultId(questions, answers, focusedId, offset) {
  const carousel = carouselFor(questions, answers, focusedId)
  if (!carousel) return null

  const index = (carousel.index + offset + carousel.ids.length) % carousel.ids.length
  return carousel.ids[index]
}
