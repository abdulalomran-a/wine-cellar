import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  try {
    // Primary: Open Food Facts — covers wines, spirits, and most retail bottles
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_en,brands,labels,origins,countries_tags,categories_tags,generic_name,image_front_url,image_url,selected_images`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()

    if (data.status === 1 && data.product) {
      const p = data.product
      const name = p.product_name || p.product_name_en || ''
      const winery = p.brands || null
      const vintage = extractVintage(name) ?? extractVintage(p.generic_name ?? '')

      const image_url =
        p.selected_images?.front?.display?.en ||
        p.selected_images?.front?.display?.fr ||
        p.image_front_url ||
        p.image_url ||
        null

      const categoryTags: string[] = p.categories_tags ?? []
      const { category, spirit_type } = detectCategory(categoryTags, name + ' ' + (p.generic_name ?? ''))

      return NextResponse.json({
        found: true,
        category,
        spirit_type,
        name,
        winery,
        varietal: p.labels || null,
        vintage,
        region: p.origins || null,
        country: p.countries_tags?.[0]?.replace('en:', '') || null,
        image_url,
      })
    }

    // Fallback: UPC Item DB
    const fallback = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      { next: { revalidate: 3600 } }
    )
    const fallbackData = await fallback.json()
    if (fallbackData.items?.length > 0) {
      const item = fallbackData.items[0]
      const text = `${item.title ?? ''} ${item.category ?? ''}`
      const { category, spirit_type } = detectCategory([], text)
      return NextResponse.json({
        found: true,
        category,
        spirit_type,
        name: item.title,
        winery: item.brand,
        varietal: null,
        vintage: extractVintage(item.title ?? ''),
        region: null,
        country: null,
        image_url: item.images?.[0] ?? null,
      })
    }

    return NextResponse.json({ found: false })
  } catch {
    return NextResponse.json({ found: false })
  }
}

function extractVintage(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0]) : null
}

/** Decide if a product is wine or spirit based on OFF category tags + name text. */
function detectCategory(
  categoryTags: string[],
  text: string
): { category: 'wine' | 'spirit'; spirit_type: string | null } {
  const t = text.toLowerCase()
  const tags = categoryTags.map(c => c.toLowerCase())
  const has = (s: string) => tags.some(c => c.includes(s)) || t.includes(s)

  // Spirit detection — order matters (specific → generic)
  const SPIRIT_MATCHERS: { test: string[]; type: string }[] = [
    { test: ['scotch', 'single-malt', 'single malt'], type: 'Scotch' },
    { test: ['bourbon'], type: 'Bourbon' },
    { test: ['whisky', 'whiskey', 'whiskies', 'whiskeys', 'rye'], type: 'Whisky' },
    { test: ['mezcal'], type: 'Mezcal' },
    { test: ['tequila', 'tequilas'], type: 'Tequila' },
    { test: ['gin', 'gins'], type: 'Gin' },
    { test: ['vodka', 'vodkas'], type: 'Vodka' },
    { test: ['rum', 'rums'], type: 'Rum' },
    { test: ['cognac'], type: 'Cognac' },
    { test: ['armagnac', 'brandy', 'brandies'], type: 'Brandy' },
    { test: ['liqueur', 'liqueurs', 'liquor', 'amaro', 'aperitif'], type: 'Liqueur' },
  ]

  for (const m of SPIRIT_MATCHERS) {
    if (m.test.some(has)) return { category: 'spirit', spirit_type: m.type }
  }

  // Generic spirit signals (no specific type detected)
  if (
    has('spirits') ||
    has('hard-liquor') ||
    has('hard liquor') ||
    has('distilled')
  ) {
    return { category: 'spirit', spirit_type: 'Other' }
  }

  // Default to wine (most barcodes for our user)
  return { category: 'wine', spirit_type: null }
}
