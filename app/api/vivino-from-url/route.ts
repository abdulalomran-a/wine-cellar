import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || !url.includes('vivino.com')) {
      return NextResponse.json({ error: 'Please provide a valid Vivino URL' }, { status: 400 })
    }

    // First try: fetch the page directly and parse __NEXT_DATA__
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept: 'text/html',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(8000),
      })

      if (res.ok) {
        const html = await res.text()

        // Parse __NEXT_DATA__ embedded JSON (Vivino uses Next.js)
        const nextDataMatch = html.match(
          /<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/
        )
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1])
            const pp = nextData?.props?.pageProps

            // Wine page or vintage page
            const wine = pp?.wine ?? pp?.vintage?.wine ?? null
            const stats =
              pp?.wine?.statistics ??
              pp?.vintage?.statistics ??
              pp?.wine?.vintage?.statistics ??
              null
            const prices: Record<string, unknown>[] =
              pp?.wine?.prices ??
              pp?.vintage?.prices ??
              []

            const rating = stats?.ratings_average ?? null
            const price = prices[0]?.amount ?? null
            const wineName = wine?.name ?? null

            if (rating || price) {
              return NextResponse.json({
                rating: rating ? Number(Number(rating).toFixed(1)) : null,
                price: price ? Math.round(Number(price) * 100) / 100 : null,
                wine_name: wineName,
              })
            }
          } catch {
            // JSON parse failed — fall through
          }
        }

        // Fallback regex on raw HTML
        const ratingMatch = html.match(/"ratings_average"\s*:\s*([\d.]+)/)
        const priceMatch = html.match(/"amount"\s*:\s*([\d.]+)/)
        const nameMatch = html.match(/"name"\s*:\s*"([^"]{3,60})"/)

        const rating = ratingMatch ? Number(Number(ratingMatch[1]).toFixed(1)) : null
        const price = priceMatch ? Math.round(Number(priceMatch[1]) * 100) / 100 : null

        if (rating || price) {
          return NextResponse.json({
            rating,
            price,
            wine_name: nameMatch?.[1] ?? null,
          })
        }
      }
    } catch {
      // Vivino blocked the direct fetch — fall through to Claude
    }

    // Second try: ask Claude to read that specific Vivino page
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 1,
          allowed_domains: ['vivino.com'],
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Go to this Vivino wine page and extract the community rating and average price: ${url}

Return ONLY a JSON object with no other text:
{
  "rating": <community rating as number e.g. 4.2, or null>,
  "price": <average price in EUR as number e.g. 25.50, or null>,
  "wine_name": "<wine name as shown on the page, or null>"
}`,
        },
      ],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Could not extract data' }, { status: 422 })
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response' }, { status: 422 })
    }

    const data = JSON.parse(jsonMatch[0]) as {
      rating: number | null
      price: number | null
      wine_name: string | null
    }

    return NextResponse.json({
      rating: data.rating ? Number(Number(data.rating).toFixed(1)) : null,
      price: data.price ? Math.round(Number(data.price) * 100) / 100 : null,
      wine_name: data.wine_name ?? null,
    })
  } catch (err) {
    console.error('vivino-from-url error:', err)
    return NextResponse.json({ error: 'Failed to fetch Vivino data' }, { status: 500 })
  }
}
