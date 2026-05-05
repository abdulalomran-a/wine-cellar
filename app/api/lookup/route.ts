import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode')
  if (!barcode) return NextResponse.json({ error: 'Barcode required' }, { status: 400 })

  try {
    // Primary: Open Food Facts — best wine database with label photos
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,product_name_en,brands,labels,origins,countries_tags,generic_name,image_front_url,image_url,selected_images`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()

    if (data.status === 1 && data.product) {
      const p = data.product
      const name = p.product_name || p.product_name_en || ''
      const winery = p.brands || null
      const vintage = extractVintage(name) ?? extractVintage(p.generic_name ?? '')

      // Pick the best available image: front label > selected display > generic
      const image_url =
        p.selected_images?.front?.display?.en ||
        p.selected_images?.front?.display?.fr ||
        p.image_front_url ||
        p.image_url ||
        null

      return NextResponse.json({
        found: true,
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
      return NextResponse.json({
        found: true,
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
