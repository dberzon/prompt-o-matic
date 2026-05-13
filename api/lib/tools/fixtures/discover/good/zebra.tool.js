import { z } from 'zod'
import { tool } from '../../../tool.js'

export default tool({
  name: 'zebra',
  description: 'fixture zebra',
  input: z.object({}),
  output: z.object({ tag: z.literal('zebra') }),
  handler: () => ({ tag: 'zebra' }),
})
