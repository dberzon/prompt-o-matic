import { apiPost } from './http.js'

export function buildCharacterPortfolioPlan(payload) {
  return apiPost('/api/character-portfolio-plan', payload)
}

export function queueCharacterPortfolio(payload) {
  return apiPost('/api/character-portfolio-queue', payload)
}

export function queueMoreTakes(payload) {
  return apiPost('/api/actor-more-takes', payload)
}

