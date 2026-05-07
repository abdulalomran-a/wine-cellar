import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { findWineImage } from '@/lib/wine-image'
import { fetchVivinoData } from '@/lib/vivino'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

    // Step 1: Claude reads the label
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
              text: `You are a wine label expert. Extract wine information from this label photo and return ONLY valid JSON with these exact fields (use null if not visible):
{
  "name": "wine name/cuvee",
  "winery": "producer/chateau/winery name",
  "vintage": year as integer or null,
  "varietal": "grape variety",
  "region": "wine region/appellation",
  "country": "country of origin"
}
Return only the JSON object, no other text.`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse label' }, { status: 422 })

    const wine = JSON.parse(jsonMatch[0])

    // Step 2: Fetch wine image + Vivino data in parallel
    const [image_url, vivino] = await Promise.all([
      findWineImage(wine.name, wine.winery),
      fetchVivinoData(wine.name, wine.winery, wine.vintage),
    ])

    return NextResponse.json({
      found: true,
      ...wine,
      image_url,
      vivino_rating: vivino?.rating ?? null,
      vivino_price: vivino?.price ?? null,
      vivino_url: vivino?.url ?? null,
    })
  } catch (err) {
    console.error('scan-label error:', err)
    return NextResponse.json({ error: 'Failed to scan label' }, { status: 500 })
  }
}
