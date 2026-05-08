import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Ask Claude (with web search) to find a direct, public bottle-photo URL
 * for one wine, then save it on the matching wines row(s).
 *
 * Body: { name: string, winery?: string, vintage?: number }
 * If multiple wines match name+winery, all of them are updated.
 */
export async function POST(req: NextRequest) {
  try {
    const { name, winery, vintage } = await req.json()
    if (!name) return NextResponse.json({ error: 'No wine name' }, { status: 400 })

    const query = [winery, name, vintage].filter(Boolean).join(' ')

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 3,
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Find a direct image URL of a bottle photograph for this wine: "${query}".

Requirements:
- The URL must be a direct link to an image file (.jpg, .jpeg, .png, or .webp)
- The image must be a photograph of the actual bottle showing the label
- Prefer images from the chateau's official website, Wikipedia/Wikimedia Commons, or reputable wine retailers
- The URL must be publicly accessible (no login required)

Return ONLY a JSON object with no other text:
{"image_url": "https://...direct-image-url.jpg"}

If you cannot find a confidently correct image, return: {"image_url": null}`,
        },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response' }, { status: 422 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse' }, { status: 422 })

    const data = JSON.parse(jsonMatch[0]) as { image_url: string | null }
    if (!data.image_url) {
      return NextResponse.json({ found: false, updated: 0 })
    }

    // Verify the URL actually returns an image
    let verified = false
    try {
      const head = await fetch(data.image_url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(6000),
      })
      const ct = head.headers.get('content-type') || ''
      verified = head.ok && ct.startsWith('image/')
    } catch {
      verified = false
    }

    if (!verified) {
      return NextResponse.json({ found: false, updated: 0, image_url: data.image_url, verified: false })
    }

    // Update all matching wines
    let q = supabase.from('wines').update({
      image_url: data.image_url,
      updated_at: new Date().toISOString(),
    }).ilike('name', `%${name}%`)

    if (winery) q = q.ilike('winery', `%${winery}%`)

    const { data: updated, error } = await q.select('id, name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      found: true,
      verified: true,
      image_url: data.image_url,
      updated: updated?.length ?? 0,
      wines: updated,
    })
  } catch (err) {
    console.error('find-image error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
