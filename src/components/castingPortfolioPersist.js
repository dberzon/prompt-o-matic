/**
 * Mark portfolio Comfy jobs for SQLite persistence so reload recovery can
 * resume polling and ingest outputs after a refresh.
 */
export function toPersistedPortfolioJobs(jobs) {
  if (!Array.isArray(jobs) || jobs.length === 0) return []
  return jobs.map((job) => ({ ...job, jobType: 'portfolio' }))
}
