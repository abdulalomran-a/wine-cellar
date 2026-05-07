import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image },
            },
            {
              type: 'text',
              text: `You are a wine label expert. Carefully read every word on this wine label and extract ONLY what is literally printed on it.

Return ONLY valid JSON with these exact fields (use null if not clearly visible):
{
  "name": "the cuvee or wine name exactly as printed (NOT the winery name)",
  "winery": "the producer, chateau, domaine, or winery name exactly as printed",
  "vintage": year as integer (4-digit year) or null,
  "varietal": "grape variety or blend (e.g. Cabernet Sauvignon, Bordeaux Blend)",
  "region": "the appellation or wine region (e.g. Pauillac, Napa Valley)",
  "country": "country of origin"
}

Important rules:
- "name" is the specific wine/cuvee name, NOT the winery. Many wines don't have a separate cuvee name — in that case use the appellation or the winery name if that's all there is.
- "winery" is the producer. For French chateaux, include the full "Chateau X" name.
- Be precise — do not invent or guess details not on the label.
- Return only the JSON object, no other text.`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse label' }, { status: 422 })

    const wine = JSON.parse(jsonMatch[0])

    return NextResponse.json({ found: true, ...wine })
  } catch (err) {
    console.error('scan-label error:', err)
    return NextResponse.json({ error: 'Failed to scan label' }, { status: 500 })
  }
}
