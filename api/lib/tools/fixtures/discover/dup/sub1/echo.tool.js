import { z } from 'zod'
import { tool } from '../../../../tool.js'

export default tool({
  name: 'echo',
  description: 'dup a',
  input: z.object({}),
  output: z.object({ which: z.literal('a') }),
  handler: () => ({ which: 'a' }),
})
