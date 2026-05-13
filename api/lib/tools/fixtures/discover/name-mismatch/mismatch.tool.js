import { z } from 'zod'
import { tool } from '../../../tool.js'

export default tool({
  name: 'oops',
  description: 'wrong name vs filename',
  input: z.object({}),
  output: z.object({}),
  handler: () => ({}),
})
