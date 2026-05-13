import { geographyStage } from './geography.js'
import { historyStage } from './history.js'
import { inhabitantsStage } from './inhabitants.js'

/** @type {import('../../types.js').ExtrapolationStage[]} */
export const locationStages = [geographyStage, inhabitantsStage, historyStage]

/** Alias for spec naming `stages.location`. */
export const location = locationStages
