import { buildS1Dynamic } from '../../../extrapolation/stages.js'
import { RUSLAN_ENTITY, RUSLAN_S1_SOURCE_TEXT } from './_ruslanContext.js'

export default {
  promptId: 'extrapolation.s1.entityExtraction',
  version: '1',
  variables: {
    dynamicContext: buildS1Dynamic({ entity: RUSLAN_ENTITY, sourceText: RUSLAN_S1_SOURCE_TEXT }),
  },
}
