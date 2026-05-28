// All questions are enabled and none are hidden in the frontend.
// Previously some questions were gated by whitelists; to "release" them
// we consider any non-empty question id as available.
export function isQuestionEnabled(questionId: string | null | undefined): boolean {
  return Boolean(questionId)
}

export function isQuestionHidden(questionId: string | null | undefined): boolean {
  void questionId
  return false
}
