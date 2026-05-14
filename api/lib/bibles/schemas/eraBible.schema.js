import { z } from 'zod'
import { recommended, required } from './_sectionMarkers.js'

const nonEmpty = z.string().min(1)

const eraIdentityInner = z
  .object({
    label: nonEmpty,
  })
  .strict()

const eraTimeframeInner = z
  .object({
    spanDescription: nonEmpty,
  })
  .strict()

/**
 * Era Bible — period continuity document (schema-only; no DB entity type yet).
 *
 * Sections: identity(required), timeframe(required), materialCulture(recommended),
 * slang(recommended), socialNorms(recommended), tabuos(recommended), visualMotifs(recommended)
 */
export const EraBibleSchema = z
  .object({
    identity: required(eraIdentityInner),
    timeframe: required(eraTimeframeInner),
    materialCulture: recommended(nonEmpty).optional(),
    slang: recommended(nonEmpty).optional(),
    socialNorms: recommended(nonEmpty).optional(),
    tabuos: recommended(nonEmpty).optional(),
    visualMotifs: recommended(nonEmpty).optional(),
  })
  .strict()

/** @param {unknown} input */
export function parseEraBible(input) {
  return EraBibleSchema.parse(input)
}
