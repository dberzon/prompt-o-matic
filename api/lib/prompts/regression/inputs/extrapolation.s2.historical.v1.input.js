import { buildS2Dynamic } from '../../../extrapolation/stages.js'
import { RUSLAN_CANON_ATTRIBUTES, RUSLAN_ENTITY, RUSLAN_PRIOR } from './_ruslanContext.js'

export default {
  promptId: 'extrapolation.s2.historical',
  version: '1',
  variables: {
    dynamicContext: buildS2Dynamic({
      entity: RUSLAN_ENTITY,
      canonAttributes: RUSLAN_CANON_ATTRIBUTES,
      prior: RUSLAN_PRIOR,
    }),
  },
}
