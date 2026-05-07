export interface VivinoResult {
  rating: number | null
  price: number | null
  url: string
  wine_name: string | null
}

/** Normalise a string for fuzzy comparison */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split into tokens, filtering short stop-words */
function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter(t => t.length > 2)
}

/**
 * Score how well a Vivino wine name matches our search query.
 * Returns 0..1 (1 = perfect match).
 */
function matchScore(candidate: string, name: string, winery: string | null | undefined): number {
  if (!candidate) return 0
  const cTokens = tokens(candidate)
  const qTokens = tokens([winery, name].filter(Boolean).join(' '))
  if (!qTokens.length) return 0

  const hits = qTokens.filter(t => cTokens.some(c => c.includes(t) || t.includes(c)))
  return hits.length / qTokens.length
}

export async function fetchVivinoData(
  name: string,
  winery?: string | null,
  vintage?: number | string | null
): Promise<VivinoResult | null> {
  // Build query: winery + name + vintage (most specific)
  const query = [winery, name, vintage].filter(Boolean).join(' ')
  const queryNoVintage = [winery, name].filter(Boolean).join(' ')
  const searchUrl = `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`

  // Helper: pick the best matching wine from a results array
  function pickBest(wines: Record<string, unknown>[]): Record<string, unknown> | null {
    if (!wines.length) return null

    // Score each result
    const scored = wines.map(w => {
      const candidateName = [(w.winery as Record<string, unknown>)?.name, w.name]
        .filter(Boolean)
        .join(' ') as string
      const score = matchScore(candidateName, name, winery)
      return { w, score }
    })

    // Sort best first
    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    // Reject if less than 30% token overlap — likely a wrong wine
    if (best.score < 0.3) return null

    return best.w
  }

  // ── Attempt 1: Vivino unofficial JSON API ──────────────────────────────────
  for (const q of [query, queryNoVintage]) {
    try {
      const res = await fetch(
        `https://www.vivino.com/api/wines/search?q=${encodeURIComponent(q)}&language=en&currency_code=EUR`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: 'https://www.vivino.com/',
          },
          signal: AbortSignal.timeout(8000),
        }
      )

      if (res.ok) {
        const contentType = res.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          const data = await res.json()
          const wines: Record<string, unknown>[] = data.wines ?? data.results ?? []

          const w = pickBest(wines)
          if (w) {
            const stats = (w.statistics ?? w.vintage) as Record<string, unknown> | null
            const rating =
              (stats as Record<string, unknown>)?.ratings_average ??
              w.ratings_average ??
              null
            const prices = (w.prices ?? []) as Record<string, unknown>[]
            const price = prices[0]?.amount ?? null
            const id = w.id ?? null
            const wineUrl = id ? `https://www.vivino.com/wines/${id}` : searchUrl

            if (rating || price) {
              const wineName = [(w.winery as Record<string, unknown>)?.name, w.name]
                .filter(Boolean)
                .join(' ') || null
              return {
                rating: rating ? Number(Number(rating).toFixed(1)) : null,
                price: price ? Math.round(Number(price) * 100) / 100 : null,
                url: wineUrl as string,
                wine_name: wineName as string | null,
              }
            }
          }
        }
      }
    } catch {
      // API blocked or network error — continue to next attempt
    }
  }

  // ── Attempt 2: Parse Vivino search page HTML ──────────────────────────────
  try {
    const pageRes = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!pageRes.ok) return null
    const html = await pageRes.text()

    // Extract first wine name from page to validate match
    const nameMatch = html.match(/"vintage":\{"name"\s*:\s*"([^"]+)"/)
    const pageWineName = nameMatch ? nameMatch[1] : ''

    // If we can read a name and it doesn't match at all, bail out
    if (pageWineName && matchScore(pageWineName, name, winery) < 0.25) {
      return null
    }

    const ratingMatch = html.match(/"ratings_average"\s*:\s*([\d.]+)/)
    const priceMatch = html.match(/"amount"\s*:\s*([\d.]+)/)
    const idMatch = html.match(/"id"\s*:\s*(\d{5,})/)

    const rating = ratingMatch ? Number(Number(ratingMatch[1]).toFixed(1)) : null
    const price = priceMatch ? Math.round(Number(priceMatch[1]) * 100) / 100 : null
    const wineUrl = idMatch
      ? `https://www.vivino.com/wines/${idMatch[1]}`
      : searchUrl

    if (rating || price) {
      return { rating, price, url: wineUrl, wine_name: pageWineName || null }
    }
  } catch {
    // ignore
  }

  return null
}
