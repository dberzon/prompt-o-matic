/**
 * Build DB updates after an in-poll portfolio retry replaces failed promptIds.
 * React state alone is not enough — reload restores listActiveComfyJobs('portfolio'),
 * so replacements must be saved and old ids terminalized.
 *
 * @param {Map<string, object>} replacements oldPromptId → new job
 * @returns {{ oldPromptIds: string[], newJobs: object[] }}
 */
export function buildPortfolioRetryPersist(replacements) {
  if (!(replacements instanceof Map) || replacements.size === 0) {
    return { oldPromptIds: [], newJobs: [] }
  }
  const oldPromptIds = [...replacements.keys()].filter((id) => typeof id === 'string' && id.length > 0)
  const newJobs = [...replacements.values()]
    .filter((job) => job && typeof job.promptId === 'string' && job.promptId.length > 0)
    .map((job) => ({ ...job, jobType: 'portfolio' }))
  return { oldPromptIds, newJobs }
}
