import { buildS3Dynamic } from '../../../extrapolation/stages.js'
import { RUSLAN_CANON_ATTRIBUTES, RUSLAN_ENTITY, RUSLAN_PRIOR } from './_ruslanContext.js'

export default {
  promptId: 'extrapolation.s3.psychology',
  version: '1',
  variables: {
    dynamicContext: buildS3Dynamic({
      entity: RUSLAN_ENTITY,
      canonAttributes: RUSLAN_CANON_ATTRIBUTES,
      prior: RUSLAN_PRIOR,
    }),
  },
}
