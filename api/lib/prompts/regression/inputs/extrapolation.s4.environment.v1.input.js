import { buildS4Dynamic } from '../../../extrapolation/stages.js'
import {
  RUSLAN_CANON_ATTRIBUTES,
  RUSLAN_ENTITY,
  RUSLAN_PRIOR,
  RUSLAN_RELATIONSHIPS,
} from './_ruslanContext.js'

export default {
  promptId: 'extrapolation.s4.environment',
  version: '1',
  variables: {
    dynamicContext: buildS4Dynamic({
      entity: RUSLAN_ENTITY,
      canonAttributes: RUSLAN_CANON_ATTRIBUTES,
      relationships: RUSLAN_RELATIONSHIPS,
      prior: RUSLAN_PRIOR,
    }),
  },
}
