export interface VivinoResult {
  rating: number | null
  price: number | null
  url: string
  wine_name: string | null
}

export async function fetchVivinoData(
  name: string,
  winery?: string | null,
  vintage?: number | string | null
): Promise<VivinoResult | null> {
  const query = [winery, name, vintage].filter(Boolean).join(' ')
  const searchUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`

  try {
    // Try Vivino's unofficial search API
    const res = await fetch(
      `https://www.vivino.com/api/wines/search?q=${encodeURIComponent(query)}&language=en&currency_code=EUR`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.vivino.com/',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (res.ok) {
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        const wines: Record<string, unknown>[] = data.wines ?? data.results ?? []
        if (wines.length > 0) {
          const w = wines[0] as Record<string, unknown>
          const stats = (w.statistics ?? w.vintage) as Record<string, unknown> | null
          const rating =
            (stats as Record<string, unknown>)?.ratings_average ??
            w.ratings_average ??
            null
          const prices = (w.prices ?? []) as Record<string, unknown>[]
          const price = prices[0]?.amount ?? null
          const id = w.id ?? null
          const wineUrl = id
            ? `https://www.vivino.com/wines/${id}`
            : searchUrl

          if (rating || price) {
            return {
              rating: rating ? Number(Number(rating).toFixed(1)) : null,
              price: price ? Math.round(Number(price) * 100) / 100 : null,
              url: wineUrl as string,
              wine_name: (w.name as string) ?? null,
            }
          }
        }
      }
    }
  } catch {
    // API blocked or network error — fall through to HTML parse
  }

  // Fallback: parse Vivino search page HTML for embedded JSON state
  try {
    const pageRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!pageRes.ok) return null
    const html = await pageRes.text()

    // Look for ratings_average in the page JSON
    const ratingMatch = html.match(/"ratings_average"\s*:\s*([\d.]+)/)
    const priceMatch = html.match(/"amount"\s*:\s*([\d.]+)/)
    const idMatch = html.match(/"id"\s*:\s*(\d{5,})/)

    const rating = ratingMatch ? Number(Number(ratingMatch[1]).toFixed(1)) : null
    const price = priceMatch ? Math.round(Number(priceMatch[1]) * 100) / 100 : null
    const wineUrl = idMatch
      ? `https://www.vivino.com/wines/${idMatch[1]}`
      : searchUrl

    if (rating || price) {
      return { rating, price, url: wineUrl, wine_name: null }
    }
  } catch {
    // ignore
  }

  return null
}
