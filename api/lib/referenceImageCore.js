import { DEFAULT_ANTHROPIC_MODEL, envRead } from './llm/providers/shared.js'

const SYSTEM_PROMPT = `You are a cinematography analyst. Given a reference image, extract visual characteristics useful for generating a similar image with a text-to-image model.

Return a JSON object with EXACTLY these fields — nothing else:
{
  "palette": "one sentence: dominant colors, grade, saturation level",
  "lighting": "one sentence: light quality (hard/soft), direction, temperature, source type",
  "composition": "one sentence: shot scale, framing, depth of field, subject placement",
  "filmCharacter": "one sentence: grain, softness, any analog or digital quality",
  "mood": "2–4 words only — physical descriptors, not emotional labels",
  "chipSuggestions": {
    "light": ["1–2 short cinematic light phrases matching what you see"],
    "color": ["1–2 short grade/palette phrases"],
    "film": ["0–1 film stock or grain phrase"]
  }
}

STRICT RULES:
- Output ONLY the raw JSON object. Zero preamble, zero markdown, zero code fences, zero explanations.
- The output must start exactly with { and end exactly with }.
- Use double quotes for all keys and string values. Ensure valid JSON syntax.
- All descriptions must be physical and material — never abstract or emotional.
- chipSuggestions values are short phrases (5–10 words each) using cinematic prompt language optimized for Qwen-Image 2512.
- If a field is not clearly visible or relevant, use an empty string or empty array.
- Forbidden in any field: mood words (moody, atmospheric, mysterious, intense, brooding, dreamlike). Translate to observable visual properties only.`

function cleanReferenceImageJsonText(text) {
  return String(text ?? '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export async function runReferenceImageAnalysis({ payload, env = process.env }) {
  const { imageDataUrl } = payload || {}

  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(imageDataUrl || '')
  if (!match) {
    const err = new Error('Missing or invalid imageDataUrl — must be a base64 data URL')
    err.status = 400
    throw err
  }

  const [, mediaType, base64Data] = match

  if (base64Data.length > 7_000_000) {
    const err = new Error('Image too large — please use an image under ~5MB')
    err.status = 413
    throw err
  }

  const apiKey = envRead(env, 'ANTHROPIC_API_KEY')
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY not configured')
    err.status = 500
    throw err
  }

  const model = envRead(env, 'ANTHROPIC_MODEL') || DEFAULT_ANTHROPIC_MODEL

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            { type: 'text', text: 'Analyze this reference image.' },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text()
    const err = new Error(`Vision API error: ${response.status}`)
    err.status = 502
    err.meta = errBody
    throw err
  }

  const data = await response.json()
  const text = cleanReferenceImageJsonText(data?.content?.[0]?.text)

  try {
    const features = JSON.parse(text)
    return { ok: true, features }
  } catch {
    return { ok: true, features: { notes: text } }
  }
}
