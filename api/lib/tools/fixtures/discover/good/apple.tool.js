import { z } from 'zod'
import { tool } from '../../../tool.js'

export default tool({
  name: 'apple',
  description: 'fixture apple',
  input: z.object({}),
  output: z.object({ tag: z.literal('apple') }),
  handler: () => ({ tag: 'apple' }),
})
