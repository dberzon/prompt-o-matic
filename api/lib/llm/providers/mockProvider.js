export async function mockProvider({ payload, userMessage }) {
  const value = typeof payload?.mockResponse === 'string' && payload.mockResponse.trim()
    ? payload.mockResponse.trim()
    : `mock provider response: ${userMessage.slice(0, 40)}`
  return value
}
