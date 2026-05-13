import { z } from 'zod'
import { tool } from '../../../tool.js'

export default tool({
  name: 'mango',
  description: 'fixture mango',
  input: z.object({}),
  output: z.object({ tag: z.literal('mango') }),
  handler: () => ({ tag: 'mango' }),
})
