import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

type LookupResult = {
  found: boolean
  category?: 'wine' | 'spirit'
  spirit_type?: string | null
  name?: string
  winery?: string | null
  varietal?: string | null
  vintage?: number | null
  region?: string | null
  country?: string | null
  image_url?: string | null
}

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  // Tier 1: Open Food Facts
  let result = await tryOpenFoodFacts(barcode)
  if (result.found) return NextResponse.json(result)

  // Tier 2: brocade.io (free, no auth)
  result = await tryBrocade(barcode)
  if (result.found) return NextResponse.json(result)

  // Tier 3: UPCItemDB
  result = await tryUpcItemDb(barcode)
  if (result.found) return NextResponse.json(result)

  // Tier 4: Claude web search — covers obscure/case barcodes by reading retailer pages
  result = await tryClaudeWebSearch(barcode)
  if (result.found) return NextResponse.json(result)

  return NextResponse.json({ found: false })
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 1: Open Food Facts
// ────────────────────────────────────────────────────────────────────────────
async function tryOpenFoodFacts(barcode: string): Promise<LookupResult> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_en,brands,labels,origins,countries_tags,categories_tags,generic_name,image_front_url,image_url,selected_images`,
      { signal: AbortSignal.timeout(7000), next: { revalidate: 3600 } }
    )
    const data = await res.json()
    if (data.status !== 1 || !data.product) return { found: false }
    const p = data.product
    const name = p.product_name || p.product_name_en || ''
    if (!name) return { found: false }

    const image_url =
      p.selected_images?.front?.display?.en ||
      p.selected_images?.front?.display?.fr ||
      p.image_front_url ||
      p.image_url ||
      null

    const { category, spirit_type } = detectCategory(p.categories_tags ?? [], `${name} ${p.brands ?? ''} ${p.generic_name ?? ''}`)

    return {
      found: true,
      category,
      spirit_type,
      name,
      winery: p.brands || null,
      varietal: p.labels || null,
      vintage: extractVintage(name) ?? extractVintage(p.generic_name ?? ''),
      region: p.origins || null,
      country: p.countries_tags?.[0]?.replace('en:', '') || null,
      image_url,
    }
  } catch {
    return { found: false }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 2: brocade.io — free, no auth
// ────────────────────────────────────────────────────────────────────────────
async function tryBrocade(barcode: string): Promise<LookupResult> {
  try {
    const res = await fetch(`https://www.brocade.io/api/items/${barcode}`, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { found: false }
    const data = await res.json()
    const name = data.name || data.title
    if (!name) return { found: false }

    const text = `${name} ${data.brand_name ?? ''} ${data.description ?? ''}`
    const { category, spirit_type } = detectCategory([], text)

    return {
      found: true,
      category,
      spirit_type,
      name,
      winery: data.brand_name || null,
      varietal: null,
      vintage: extractVintage(name),
      region: null,
      country: null,
      image_url: data.image_url || null,
    }
  } catch {
    return { found: false }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 3: UPCItemDB
// ────────────────────────────────────────────────────────────────────────────
async function tryUpcItemDb(barcode: string): Promise<LookupResult> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 3600 },
    })
    const data = await res.json()
    if (!data.items?.length) return { found: false }
    const item = data.items[0]
    const text = `${item.title ?? ''} ${item.brand ?? ''} ${item.category ?? ''}`
    const { category, spirit_type } = detectCategory([], text)
    return {
      found: true,
      category,
      spirit_type,
      name: item.title,
      winery: item.brand || null,
      varietal: null,
      vintage: extractVintage(item.title ?? ''),
      region: null,
      country: null,
      image_url: item.images?.[0] ?? null,
    }
  } catch {
    return { found: false }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Tier 4: Claude web search — finds the product on any retailer page on the web
// ────────────────────────────────────────────────────────────────────────────
async function tryClaudeWebSearch(barcode: string): Promise<LookupResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { found: false }
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 3 }],
      messages: [
        {
          role: 'user',
          content: `Look up the product with barcode/UPC/EAN: ${barcode}.

Search the web. The barcode might be on retailer sites, distributor catalogs, or wine/spirits databases. Find what bottle it is.

Return ONLY this JSON (no markdown, no other text):
{
  "name": "<product name>",
  "brand": "<brand or distillery or winery>",
  "category": "wine" or "spirit",
  "spirit_type": "<Whisky|Bourbon|Scotch|Vodka|Gin|Rum|Tequila|Mezcal|Cognac|Brandy|Liqueur|Other>" (only if category is spirit, otherwise null),
  "country": "<country>",
  "vintage": <year or null>
}

If you cannot identify the product confidently, return: {"name": null}`,
        },
      ],
    })

    const allText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
    const fenced = allText.match(/```(?:json)?\s*([\s\S]*?)```/)
    const body = fenced ? fenced[1] : allText
    const m = body.match(/\{[\s\S]*\}/)
    if (!m) return { found: false }

    const data = JSON.parse(m[0]) as {
      name: string | null
      brand: string | null
      category: 'wine' | 'spirit'
      spirit_type: string | null
      country: string | null
      vintage: number | null
    }
    if (!data.name) return { found: false }

    return {
      found: true,
      category: data.category === 'spirit' ? 'spirit' : 'wine',
      spirit_type: data.spirit_type || null,
      name: data.name,
      winery: data.brand || null,
      varietal: null,
      vintage: data.vintage || null,
      region: null,
      country: data.country || null,
      image_url: null,
    }
  } catch (err) {
    console.error('claude lookup error:', err)
    return { found: false }
  }
}

function extractVintage(text: string): number | null {
  const match = text.match(/\b(19|20)\d{2}\b/)
  return match ? parseInt(match[0]) : null
}

/** Decide if a product is wine or spirit based on category tags + name text. */
function detectCategory(
  categoryTags: string[],
  text: string
): { category: 'wine' | 'spirit'; spirit_type: string | null } {
  const t = text.toLowerCase()
  const tags = categoryTags.map(c => c.toLowerCase())
  const has = (s: string) => tags.some(c => c.includes(s)) || t.includes(s)

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

  if (has('spirits') || has('hard-liquor') || has('hard liquor') || has('distilled')) {
    return { category: 'spirit', spirit_type: 'Other' }
  }

  // Brand name detection
  const BRAND_TO_TYPE: Record<string, string> = {
    'stolichnaya': 'Vodka', 'absolut': 'Vodka', 'smirnoff': 'Vodka', 'grey goose': 'Vodka',
    'belvedere': 'Vodka', 'ketel one': 'Vodka', 'tito': 'Vodka', 'beluga': 'Vodka',
    'cîroc': 'Vodka', 'ciroc': 'Vodka',
    'johnnie walker': 'Scotch', 'johnny walker': 'Scotch', 'macallan': 'Scotch',
    'glenfiddich': 'Scotch', 'glenlivet': 'Scotch', 'laphroaig': 'Scotch', 'lagavulin': 'Scotch',
    'highland park': 'Scotch', 'balvenie': 'Scotch', 'chivas': 'Scotch', 'dewar': 'Scotch',
    'bowmore': 'Scotch', 'oban': 'Scotch', 'talisker': 'Scotch', 'ardbeg': 'Scotch',
    'jameson': 'Whisky', 'tullamore': 'Whisky', 'redbreast': 'Whisky',
    'jack daniel': 'Bourbon', 'jim beam': 'Bourbon', "maker's mark": 'Bourbon', 'makers mark': 'Bourbon',
    'woodford': 'Bourbon', 'wild turkey': 'Bourbon', 'bulleit': 'Bourbon', 'buffalo trace': 'Bourbon',
    'crown royal': 'Whisky', 'suntory': 'Whisky', 'hibiki': 'Whisky', 'yamazaki': 'Whisky', 'nikka': 'Whisky',
    'tanqueray': 'Gin', 'bombay': 'Gin', 'hendrick': 'Gin', 'beefeater': 'Gin', 'monkey 47': 'Gin',
    'gordon': 'Gin', 'plymouth': 'Gin',
    'bacardi': 'Rum', 'havana club': 'Rum', 'captain morgan': 'Rum', 'mount gay': 'Rum',
    'diplomatico': 'Rum', 'zacapa': 'Rum', 'el dorado': 'Rum', 'kraken': 'Rum',
    'patron': 'Tequila', 'patrón': 'Tequila', 'don julio': 'Tequila', 'jose cuervo': 'Tequila',
    'casamigos': 'Tequila', 'clase azul': 'Tequila', 'herradura': 'Tequila', 'avion': 'Tequila',
    'del maguey': 'Mezcal', 'montelobos': 'Mezcal',
    'hennessy': 'Cognac', 'remy martin': 'Cognac', 'rémy martin': 'Cognac', 'martell': 'Cognac',
    'courvoisier': 'Cognac', 'camus': 'Cognac',
    'aperol': 'Liqueur', 'campari': 'Liqueur', 'cointreau': 'Liqueur', 'grand marnier': 'Liqueur',
    'baileys': 'Liqueur', 'kahlua': 'Liqueur', 'amaretto': 'Liqueur', 'jagermeister': 'Liqueur',
    'jägermeister': 'Liqueur', 'fernet': 'Liqueur', 'chartreuse': 'Liqueur',
  }
  for (const [brand, type] of Object.entries(BRAND_TO_TYPE)) {
    if (t.includes(brand)) return { category: 'spirit', spirit_type: type }
  }

  return { category: 'wine', spirit_type: null }
}
