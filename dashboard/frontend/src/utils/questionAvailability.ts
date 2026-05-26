const ENABLED_QUESTIONS = new Set(['q1', 'q2', 'q3', 'q4', 'q6', 'q8'])

export function isQuestionEnabled(questionId: string | null | undefined): boolean {
  if (!questionId) return false
  return ENABLED_QUESTIONS.has(questionId.trim().toLowerCase())
}

