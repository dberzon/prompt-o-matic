import { buildS6Dynamic } from '../../../extrapolation/stages.js'
import { RUSLAN_ACTIVE_ATTRIBUTES, RUSLAN_ENTITY, RUSLAN_PRIOR } from './_ruslanContext.js'

export default {
  promptId: 'extrapolation.s6.conflict',
  version: '1',
  variables: {
    dynamicContext: buildS6Dynamic({
      entity: RUSLAN_ENTITY,
      attributes: RUSLAN_ACTIVE_ATTRIBUTES,
      prior: RUSLAN_PRIOR,
    }),
  },
}
