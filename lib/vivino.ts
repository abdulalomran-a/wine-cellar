import Anthropic from '@anthropic-ai/sdk'

export interface VivinoResult {
  rating: number | null
  price: number | null
  url: string
  wine_name: string | null
}

let _client: Anthropic | null = null
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function fetchVivinoData(
  name: string,
  winery?: string | null,
  vintage?: number | string | null
): Promise<VivinoResult | null> {
  const query = [winery, name, vintage].filter(Boolean).join(' ')
  const fallbackUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`

  try {
    const client = getClient()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      tools: [
        {
          type: 'web_search_20250305' as const,
          name: 'web_search',
          max_uses: 2,
          allowed_domains: ['vivino.com'],
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Search Vivino for this wine: "${query}".
Find the exact wine on vivino.com and return ONLY a JSON object with no other text:
{
  "rating": <community rating as number, e.g. 4.2, or null if not found>,
  "price": <average price in EUR as number, e.g. 25.50, or null if not found>,
  "url": "<full vivino.com URL for this wine>",
  "wine_name": "<exact wine name as shown on Vivino>"
}
If you cannot find this specific wine on Vivino, return: {"rating":null,"price":null,"url":"${fallbackUrl}","wine_name":null}`,
        },
      ],
    })

    // Extract the text block from the response
    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const data = JSON.parse(jsonMatch[0]) as {
      rating: number | null
      price: number | null
      url: string
      wine_name: string | null
    }

    return {
      rating: data.rating ? Number(Number(data.rating).toFixed(1)) : null,
      price: data.price ? Math.round(Number(data.price) * 100) / 100 : null,
      url: data.url || fallbackUrl,
      wine_name: data.wine_name || null,
    }
  } catch (err) {
    console.error('fetchVivinoData error:', err)
    return null
  }
}
