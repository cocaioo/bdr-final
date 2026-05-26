const ENABLED_QUESTIONS = new Set(['q1', 'q3', 'q4', 'q6', 'q8', 'q10'])
const HIDDEN_QUESTIONS = new Set(['q7'])

export function isQuestionEnabled(questionId: string | null | undefined): boolean {
  if (!questionId) return false
  return ENABLED_QUESTIONS.has(questionId.trim().toLowerCase())
}

export function isQuestionHidden(questionId: string | null | undefined): boolean {
  if (!questionId) return false
  return HIDDEN_QUESTIONS.has(questionId.trim().toLowerCase())
}
