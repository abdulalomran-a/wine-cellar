import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Read a barcode number from a photo using Claude vision.
 * More reliable than client-side image-decoder libraries for phone photos.
 */
export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json()
    if (!image) return NextResponse.json({ error: 'No image' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 64,
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
              text: `Look at this photo of a product barcode. Read ONLY the digits printed under (or sometimes above) the bars.

Return ONLY the digits as a single string, no spaces, no other text. Typical barcodes are 12 (UPC-A) or 13 (EAN-13) digits.

If you cannot clearly read all the digits, return exactly: NONE`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const digits = text.replace(/\D/g, '')

    if (!digits || digits.length < 8 || digits.length > 14) {
      return NextResponse.json({ found: false, raw: text })
    }

    return NextResponse.json({ found: true, barcode: digits })
  } catch (err) {
    console.error('read-barcode error:', err)
    return NextResponse.json({ error: 'Failed to read barcode' }, { status: 500 })
  }
}
